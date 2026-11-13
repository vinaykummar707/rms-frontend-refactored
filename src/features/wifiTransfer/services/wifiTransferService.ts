import axios from "axios";
import JSZip from "jszip";
import type {
  IMicrocontrollerStatus,
  IHardwareUploadResponse,
  ITransferStartRequest,
  ITransferStartResponse,
  IFileStartRequest,
  IFileStartResponse,
  IFileChunkResponse,
  IFileEndRequest,
  IFileEndResponse,
  ITransferStatusResponse,
  ITransferCompleteRequest,
  ITransferCompleteResponse,
  ITransferCancelRequest,
  ITransferCancelResponse,
  ITransferFileItem,
  ITransferSummary,
  ITransferProgress,
} from "../types/wifiTransfer";

export const DEFAULT_CHUNK_SIZE = 512;
export const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MiB
export const MAX_PATH_LENGTH_BYTES = 200;

const DEFAULT_TIMEOUT_MS = 60000;
const STATUS_TIMEOUT_MS = 5000;
const CHUNK_TIMEOUT_MS = 15000;
const CHUNK_MAX_RETRIES = 2;

export function formatBaseUrl(ipOrUrl: string): string {
  let cleaned = ipOrUrl.trim();
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = `http://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, "");
}

/**
 * Validates and normalizes relative path according to FAT / STM32 specification rules:
 * - Relative path from extracted ZIP root (no leading /)
 * - / as separator
 * - No empty segments, ., or ..
 * - No FAT-forbidden characters: " * : < > ? \ | or control characters (< 0x20)
 * - Max path length 200 bytes
 */
export function validateAndNormalizePath(path: string): {
  valid: boolean;
  normalizedPath: string;
  error?: string;
} {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "").trim();

  if (!normalized) {
    return { valid: false, normalizedPath: normalized, error: "Empty path" };
  }

  const encoder = new TextEncoder();
  if (encoder.encode(normalized).length > MAX_PATH_LENGTH_BYTES) {
    return {
      valid: false,
      normalizedPath: normalized,
      error: `Path exceeds ${MAX_PATH_LENGTH_BYTES} bytes (${normalized})`,
    };
  }

  const segments = normalized.split("/");
  for (const seg of segments) {
    if (!seg || seg === "." || seg === "..") {
      return {
        valid: false,
        normalizedPath: normalized,
        error: `Invalid path traversal segment in "${normalized}"`,
      };
    }
    // Check FAT-forbidden characters: " * : < > ? \ | and control characters (< 32)
    const hasForbidden = [...seg].some(
      (c) => c.charCodeAt(0) < 32 || /[*:"<>?\\|]/.test(c)
    );
    if (hasForbidden) {
      return {
        valid: false,
        normalizedPath: normalized,
        error: `FAT-forbidden characters in segment "${seg}"`,
      };
    }
  }

  return { valid: true, normalizedPath: normalized };
}

/**
 * Generates an ASCII transfer identifier (max 40 chars)
 * e.g. route-upload-20261113-a1b2c3
 */
export function generateTransferId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `route-upload-${dateStr}-${randomStr}`.slice(0, 40);
}

/**
 * Checks connectivity and queries the status of the microcontroller signboard.
 * Queries /api/status (with fallback to /api/ping if status endpoint is missing).
 */
export async function checkHardwareStatus(
  ipOrUrl: string
): Promise<IMicrocontrollerStatus> {
  const baseUrl = formatBaseUrl(ipOrUrl);
  try {
    const response = await axios.get<Record<string, unknown>>(`${baseUrl}/api/status`, {
      timeout: STATUS_TIMEOUT_MS,
      headers: {
        Accept: "application/json",
      },
    });

    const data = (response.data || {}) as Record<string, unknown>;
    const firmware = String(
      data.esp_firmware ||
        data.firmware ||
        data.frimware ||
        data.firmwareVersion ||
        "Unknown"
    );

    return {
      ...data,
      device_id: String(data.device_id || data.deviceId || "Unknown Device"),
      esp_firmware: firmware,
      firmware,
      frimware: firmware,
      wifi_status: String(data.wifi_status || data.wifiStatus || "online"),
      wifi_ip: String(data.wifi_ip || data.ip || ipOrUrl),
      storage_status: String(data.storage_status || "ready"),
      storage_type: String(data.storage_type || "LittleFS"),
      upload_format: data.upload_format ? String(data.upload_format) : undefined,
      total_bytes: typeof data.total_bytes === "number" ? data.total_bytes : undefined,
      used_bytes: typeof data.used_bytes === "number" ? data.used_bytes : undefined,
      free_bytes: typeof data.free_bytes === "number" ? data.free_bytes : undefined,
      max_zip_upload_bytes:
        typeof data.max_zip_upload_bytes === "number"
          ? data.max_zip_upload_bytes
          : undefined,
      upload_in_progress: Boolean(data.upload_in_progress),
      last_upload_status: String(data.last_upload_status || ""),
      last_saved_file: String(data.last_saved_file || ""),
      stm32_status: String(data.stm32_status || data.stm32Status || "ready"),
      transfer_status: String(
        data.transfer_status || (data.upload_in_progress ? "transferring" : "idle")
      ),
    };
  } catch (error: unknown) {
    const errObj = error as
      | {
          response?: { status?: number; data?: Record<string, unknown> };
          code?: string;
          message?: string;
        }
      | undefined;

    if (errObj?.response?.status === 404) {
      const pingResponse = await axios.get<Record<string, unknown>>(`${baseUrl}/api/ping`, {
        timeout: STATUS_TIMEOUT_MS,
      });
      const data = (pingResponse.data || {}) as Record<string, unknown>;
      const firmware = String(data.firmware || data.frimware || "1.0");
      return {
        ...data,
        device_id: String(data.device_id || data.deviceId || "Device"),
        esp_firmware: firmware,
        firmware,
        frimware: firmware,
        wifi_status: String(data.wifi_status || "online"),
        wifi_ip: baseUrl.replace(/^https?:\/\//, ""),
        stm32_status: String(data.stm32_status || "ready"),
        transfer_status: String(data.transfer_status || "idle"),
      };
    }

    if (errObj?.code === "ECONNABORTED") {
      throw new Error(
        `Connection to ${baseUrl} timed out. Verify your Wi-Fi is connected to the Signboard.`,
        { cause: error }
      );
    }
    if (errObj?.message?.includes("Network Error")) {
      throw new Error(
        `Cannot reach ${baseUrl}. Please ensure you are connected to the Signboard's Wi-Fi hotspot.`,
        { cause: error }
      );
    }

    const data = errObj?.response?.data;
    const serverMsg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      errObj?.message;

    throw new Error(
      serverMsg ||
        (error instanceof Error ? error.message : "Failed to communicate with microcontroller."),
      { cause: error }
    );
  }
}

/**
 * Extracts a route package ZIP in the browser and prepares file metadata & chunks
 * according to Navitronix PIS Specification v1.0.
 */
export async function extractZipForTransfer(blob: Blob): Promise<{
  transferId: string;
  files: ITransferFileItem[];
  totalFiles: number;
  totalFolders: number;
  totalBytes: number;
  folders: string[];
}> {
  const zip = await JSZip.loadAsync(blob);
  const files: ITransferFileItem[] = [];
  const folderSet = new Set<string>();
  let totalBytes = 0;

  const entries = Object.keys(zip.files).sort();

  for (const entryName of entries) {
    const entry = zip.files[entryName];

    // Skip directories and metadata files (e.g. macOS __MACOSX / .DS_Store)
    if (
      entry.dir ||
      entryName.endsWith("/") ||
      entryName.startsWith("__MACOSX/") ||
      entryName.includes("/.DS_Store") ||
      entryName === ".DS_Store"
    ) {
      continue;
    }

    const { valid, normalizedPath, error } = validateAndNormalizePath(entryName);
    if (!valid) {
      console.warn(`[WifiTransfer] Skipping invalid file path "${entryName}":`, error);
      continue;
    }

    const data = await entry.async("uint8array");
    const sizeBytes = data.byteLength;

    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File "${normalizedPath}" size (${sizeBytes} bytes) exceeds maximum limit of 4 MiB.`
      );
    }

    // Register parent folders for STM32 FatFs folder hierarchy
    const pathParts = normalizedPath.split("/");
    if (pathParts.length > 1) {
      let accumulated = "";
      for (let i = 0; i < pathParts.length - 1; i++) {
        accumulated = accumulated ? `${accumulated}/${pathParts[i]}` : pathParts[i];
        folderSet.add(accumulated);
      }
    }

    const chunksTotal = Math.max(1, Math.ceil(sizeBytes / DEFAULT_CHUNK_SIZE));

    files.push({
      id: normalizedPath,
      path: normalizedPath,
      sizeBytes,
      chunksTotal,
      chunksSent: 0,
      status: "pending",
      data,
    });

    totalBytes += sizeBytes;
  }

  if (files.length === 0) {
    throw new Error("The selected package does not contain any valid route files.");
  }

  const folders = Array.from(folderSet).sort();
  const transferId = generateTransferId();

  return {
    transferId,
    files,
    totalFiles: files.length,
    totalFolders: folders.length,
    totalBytes,
    folders,
  };
}

// ============================================================================
// API Endpoints (Navitronix PIS Specification v1.0)
// ============================================================================

export async function startTransferSession(
  ipOrUrl: string,
  req: ITransferStartRequest,
  signal?: AbortSignal
): Promise<ITransferStartResponse> {
  const baseUrl = formatBaseUrl(ipOrUrl);
  try {
    const response = await axios.post<ITransferStartResponse>(
      `${baseUrl}/api/transfer/start`,
      req,
      {
        timeout: DEFAULT_TIMEOUT_MS,
        signal,
        headers: { "Content-Type": "application/json" },
      }
    );
    return response.data;
  } catch (err: unknown) {
    const data = (axios.isAxiosError(err) && err.response?.data) as
      | Record<string, unknown>
      | undefined;
    const serverMsg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      (err instanceof Error ? err.message : "Unknown error");
    throw new Error(`Failed to start transfer session: ${serverMsg}`, { cause: err });
  }
}

export async function startTransferFile(
  ipOrUrl: string,
  req: IFileStartRequest,
  signal?: AbortSignal
): Promise<IFileStartResponse> {
  const baseUrl = formatBaseUrl(ipOrUrl);
  try {
    const response = await axios.post<IFileStartResponse>(
      `${baseUrl}/api/transfer/file/start`,
      req,
      {
        timeout: DEFAULT_TIMEOUT_MS,
        signal,
        headers: { "Content-Type": "application/json" },
      }
    );
    return response.data;
  } catch (err: unknown) {
    const data = (axios.isAxiosError(err) && err.response?.data) as
      | Record<string, unknown>
      | undefined;
    const serverMsg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      (err instanceof Error ? err.message : "Unknown error");
    throw new Error(`Failed to prepare file "${req.path}": ${serverMsg}`, { cause: err });
  }
}

export async function sendTransferChunk(
  ipOrUrl: string,
  chunkIndex: number,
  offset: number,
  chunkBytes: Uint8Array,
  signal?: AbortSignal
): Promise<IFileChunkResponse> {
  const baseUrl = formatBaseUrl(ipOrUrl);

  const bufferSlice = chunkBytes.buffer.slice(
    chunkBytes.byteOffset,
    chunkBytes.byteOffset + chunkBytes.byteLength
  );

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= CHUNK_MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post<IFileChunkResponse>(
        `${baseUrl}/api/transfer/file/chunk?index=${chunkIndex}&offset=${offset}`,
        bufferSlice,
        {
          timeout: CHUNK_TIMEOUT_MS,
          signal,
          headers: {
            "Content-Type": "application/octet-stream",
          },
          responseType: "json",
        }
      );
      return response.data;
    } catch (err: unknown) {
      lastError = err;
      if (axios.isCancel(err) || signal?.aborted) {
        throw new Error("Transfer cancelled.", { cause: err });
      }
      const data = (axios.isAxiosError(err) && err.response?.data) as
        | Record<string, unknown>
        | undefined;
      if (data?.retryable === false) {
        break;
      }
      if (attempt < CHUNK_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }

  const errData = (axios.isAxiosError(lastError) && lastError.response?.data) as
    | Record<string, unknown>
    | undefined;
  const serverMsg =
    (typeof errData?.message === "string" && errData.message) ||
    (typeof errData?.error === "string" && errData.error) ||
    (lastError instanceof Error ? lastError.message : "Chunk upload failed");
  throw new Error(`Chunk ${chunkIndex} write failed: ${serverMsg}`, { cause: lastError });
}

export async function endTransferFile(
  ipOrUrl: string,
  req: IFileEndRequest,
  signal?: AbortSignal
): Promise<IFileEndResponse> {
  const baseUrl = formatBaseUrl(ipOrUrl);
  try {
    const response = await axios.post<IFileEndResponse>(
      `${baseUrl}/api/transfer/file/end`,
      req,
      {
        timeout: DEFAULT_TIMEOUT_MS,
        signal,
        headers: { "Content-Type": "application/json" },
      }
    );
    return response.data;
  } catch (err: unknown) {
    const data = (axios.isAxiosError(err) && err.response?.data) as
      | Record<string, unknown>
      | undefined;
    const serverMsg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      (err instanceof Error ? err.message : "Unknown error");
    throw new Error(`Failed to finalize file "${req.path}": ${serverMsg}`, { cause: err });
  }
}

export async function getTransferStatus(
  ipOrUrl: string,
  signal?: AbortSignal
): Promise<ITransferStatusResponse> {
  const baseUrl = formatBaseUrl(ipOrUrl);
  try {
    const response = await axios.get<ITransferStatusResponse>(
      `${baseUrl}/api/transfer/status`,
      {
        timeout: STATUS_TIMEOUT_MS,
        signal,
        headers: { Accept: "application/json" },
      }
    );
    return response.data;
  } catch (err: unknown) {
    const data = (axios.isAxiosError(err) && err.response?.data) as
      | Record<string, unknown>
      | undefined;
    const serverMsg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      (err instanceof Error ? err.message : "Unknown error");
    throw new Error(`Failed to query transfer status: ${serverMsg}`, { cause: err });
  }
}

export async function completeTransferSession(
  ipOrUrl: string,
  req: ITransferCompleteRequest,
  signal?: AbortSignal
): Promise<ITransferCompleteResponse> {
  const baseUrl = formatBaseUrl(ipOrUrl);
  try {
    const response = await axios.post<ITransferCompleteResponse>(
      `${baseUrl}/api/transfer/complete`,
      req,
      {
        timeout: DEFAULT_TIMEOUT_MS,
        signal,
        headers: { "Content-Type": "application/json" },
      }
    );
    return response.data;
  } catch (err: unknown) {
    const data = (axios.isAxiosError(err) && err.response?.data) as
      | Record<string, unknown>
      | undefined;
    const serverMsg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      (err instanceof Error ? err.message : "Unknown error");
    throw new Error(`Failed to complete transfer session: ${serverMsg}`, { cause: err });
  }
}

export async function cancelTransferSession(
  ipOrUrl: string,
  req: ITransferCancelRequest
): Promise<ITransferCancelResponse> {
  const baseUrl = formatBaseUrl(ipOrUrl);
  try {
    const response = await axios.post<ITransferCancelResponse>(
      `${baseUrl}/api/transfer/cancel`,
      req,
      {
        timeout: 5000,
        headers: { "Content-Type": "application/json" },
      }
    );
    return response.data;
  } catch (err: unknown) {
    const data = (axios.isAxiosError(err) && err.response?.data) as
      | Record<string, unknown>
      | undefined;
    const errorMsg =
      (typeof data?.error === "string" && data.error) ||
      (err instanceof Error ? err.message : "Failed to cancel transfer");
    return {
      success: false,
      error: errorMsg,
    };
  }
}

// ============================================================================
// Full Chunked Transfer Orchestrator
// ============================================================================

export interface IExecuteTransferOptions {
  ipOrUrl: string;
  transferId: string;
  files: ITransferFileItem[];
  totalFolders: number;
  chunkSize?: number;
  onProgress?: (progress: ITransferProgress) => void;
  onFileStatusUpdate?: (file: ITransferFileItem) => void;
  onTransferStatusPoll?: (status: ITransferStatusResponse) => void;
  signal?: AbortSignal;
}

/**
 * Executes the full sequential chunked transfer pipeline with backpressure:
 * 1. POST /api/transfer/start
 * 2. For each file:
 *    a. POST /api/transfer/file/start
 *    b. POST /api/transfer/file/chunk (sequential wait for confirmation)
 *    c. POST /api/transfer/file/end
 * 3. POST /api/transfer/complete
 */
export async function executeChunkedRouteTransfer(
  options: IExecuteTransferOptions
): Promise<ITransferSummary> {
  const {
    ipOrUrl,
    transferId,
    files,
    totalFolders,
    chunkSize = DEFAULT_CHUNK_SIZE,
    onProgress,
    onFileStatusUpdate,
    onTransferStatusPoll,
    signal,
  } = options;

  const startTime = Date.now();
  const totalFiles = files.length;
  const totalBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);

  let overallBytesLoaded = 0;
  let filesSaved = 0;
  let filesFailed = 0;
  const failedFiles: Array<{ path: string; error: string }> = [];

  let pollIntervalId: ReturnType<typeof setInterval> | null = null;
  const startPolling = () => {
    if (pollIntervalId) return;
    pollIntervalId = setInterval(async () => {
      if (signal?.aborted) return;
      try {
        const hardwareStatus = await getTransferStatus(ipOrUrl, signal);
        if (onTransferStatusPoll) {
          onTransferStatusPoll(hardwareStatus);
        }
      } catch {
        // Non-blocking poll failure
      }
    }, 1500);
  };

  const stopPolling = () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  };

  try {
    // Step 1: Start transfer session
    if (onProgress) {
      onProgress({
        currentFileIndex: 0,
        totalFiles,
        currentFilePath: "",
        currentFileSize: 0,
        currentFileLoaded: 0,
        currentChunkIndex: 0,
        currentTotalChunks: 0,
        overallBytesLoaded: 0,
        overallBytesTotal: totalBytes,
        percentage: 0,
        statusMessage: "Initializing transfer session on microcontroller...",
      });
    }

    await startTransferSession(
      ipOrUrl,
      {
        transfer_id: transferId,
        total_files: totalFiles,
        total_folders: totalFolders,
      },
      signal
    );

    startPolling();

    // Step 2: Stream each file sequentially
    for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
      if (signal?.aborted) {
        throw new Error("Transfer cancelled by user.");
      }

      const file = files[fileIndex];
      file.status = "transferring";
      file.bytesLoaded = 0;
      file.chunksSent = 0;
      if (onFileStatusUpdate) onFileStatusUpdate(file);

      const sizeBytes = file.sizeBytes;
      const chunksCount = sizeBytes === 0 ? 0 : Math.ceil(sizeBytes / chunkSize);
      file.chunksTotal = chunksCount;

      // 2a: Start file
      if (onProgress) {
        onProgress({
          currentFileIndex: fileIndex + 1,
          totalFiles,
          currentFilePath: file.path,
          currentFileSize: sizeBytes,
          currentFileLoaded: 0,
          currentChunkIndex: 0,
          currentTotalChunks: chunksCount,
          overallBytesLoaded,
          overallBytesTotal: totalBytes,
          percentage: totalBytes > 0 ? Math.round((overallBytesLoaded * 100) / totalBytes) : 0,
          statusMessage: `Opening "${file.path}" on STM32 SD card...`,
        });
      }

      try {
        await startTransferFile(
          ipOrUrl,
          {
            path: file.path,
            size_bytes: sizeBytes,
            file_index: fileIndex + 1, // 1-based index
            total_files: totalFiles,
          },
          signal
        );

        // 2b: Stream chunks with back-pressure
        for (let chunkIdx = 0; chunkIdx < chunksCount; chunkIdx++) {
          if (signal?.aborted) {
            throw new Error("Transfer cancelled by user.");
          }

          const offset = chunkIdx * chunkSize;
          const chunkEnd = Math.min(offset + chunkSize, sizeBytes);
          const chunkData = file.data.subarray(offset, chunkEnd);

          if (onProgress) {
            onProgress({
              currentFileIndex: fileIndex + 1,
              totalFiles,
              currentFilePath: file.path,
              currentFileSize: sizeBytes,
              currentFileLoaded: offset,
              currentChunkIndex: chunkIdx + 1,
              currentTotalChunks: chunksCount,
              overallBytesLoaded: overallBytesLoaded + offset,
              overallBytesTotal: totalBytes,
              percentage:
                totalBytes > 0
                  ? Math.round(((overallBytesLoaded + offset) * 100) / totalBytes)
                  : 0,
              statusMessage: `Streaming chunk ${chunkIdx + 1}/${chunksCount} for "${file.path}"...`,
            });
          }

          await sendTransferChunk(ipOrUrl, chunkIdx, offset, chunkData, signal);
          file.chunksSent = chunkIdx + 1;
          file.bytesLoaded = chunkEnd;
          if (onFileStatusUpdate) onFileStatusUpdate(file);
        }

        // 2c: End file & confirm FAT write
        if (onProgress) {
          onProgress({
            currentFileIndex: fileIndex + 1,
            totalFiles,
            currentFilePath: file.path,
            currentFileSize: sizeBytes,
            currentFileLoaded: sizeBytes,
            currentChunkIndex: chunksCount,
            currentTotalChunks: chunksCount,
            overallBytesLoaded: overallBytesLoaded + sizeBytes,
            overallBytesTotal: totalBytes,
            percentage:
              totalBytes > 0
                ? Math.round(((overallBytesLoaded + sizeBytes) * 100) / totalBytes)
                : 0,
            statusMessage: `Flushing & verifying "${file.path}" on STM32 FatFs...`,
          });
        }

        const endRes = await endTransferFile(
          ipOrUrl,
          {
            path: file.path,
            expected_size_bytes: sizeBytes,
            expected_chunks: chunksCount,
          },
          signal
        );

        if (endRes.success && endRes.status === "FILE_SAVED") {
          file.status = "saved";
          file.bytesLoaded = sizeBytes;
          filesSaved++;
          overallBytesLoaded += sizeBytes;
          if (onFileStatusUpdate) onFileStatusUpdate(file);
        } else {
          throw new Error(endRes.message || "File could not be verified on STM32 SD card");
        }
      } catch (err: unknown) {
        if (signal?.aborted) {
          throw err;
        }
        file.status = "failed";
        file.error = err instanceof Error ? err.message : "Failed to transfer file";
        filesFailed++;
        failedFiles.push({ path: file.path, error: file.error || "Unknown error" });
        if (onFileStatusUpdate) onFileStatusUpdate(file);
      }
    }

    // Step 3: Complete transfer session
    if (onProgress) {
      onProgress({
        currentFileIndex: totalFiles,
        totalFiles,
        currentFilePath: "",
        currentFileSize: 0,
        currentFileLoaded: 0,
        currentChunkIndex: 0,
        currentTotalChunks: 0,
        overallBytesLoaded,
        overallBytesTotal: totalBytes,
        percentage: 100,
        statusMessage: "Finalizing transfer session on microcontroller...",
      });
    }

    await completeTransferSession(ipOrUrl, { transfer_id: transferId }, signal);

    return {
      transferId,
      totalFiles,
      filesSaved,
      filesFailed,
      foldersCreated: totalFolders,
      totalBytes,
      bytesTransferred: overallBytesLoaded,
      durationMs: Date.now() - startTime,
      failedFiles,
    };
  } catch (error: unknown) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.message.includes("cancelled"))
    ) {
      try {
        await cancelTransferSession(ipOrUrl, { transfer_id: transferId });
      } catch {
        // ignore cancel call failures
      }
      throw new Error("Transfer cancelled.", { cause: error });
    }
    throw error;
  } finally {
    stopPolling();
  }
}

// ============================================================================
// Legacy Multipart Fallback
// ============================================================================

/**
 * Uploads the route ZIP binary blob to the microcontroller via legacy /api/upload.
 * Maintained for backward compatibility with older firmware.
 */
export async function uploadZipToHardware(options: {
  ipOrUrl: string;
  blob: Blob;
  filename?: string;
  onProgress?: (percentage: number, loaded: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<IHardwareUploadResponse> {
  const { ipOrUrl, blob, filename = "routes_export.zip", onProgress, signal } = options;
  const baseUrl = formatBaseUrl(ipOrUrl);

  const formData = new FormData();
  formData.append("file", blob, filename);

  try {
    const response = await axios.post<IHardwareUploadResponse>(
      `${baseUrl}/api/upload`,
      formData,
      {
        timeout: DEFAULT_TIMEOUT_MS,
        signal,
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && progressEvent.total > 0) {
            const percent = Math.min(
              100,
              Math.round((progressEvent.loaded * 100) / progressEvent.total)
            );
            if (onProgress) {
              onProgress(percent, progressEvent.loaded, progressEvent.total);
            }
          }
        },
      }
    );

    return response.data || { success: true };
  } catch (error: unknown) {
    if (axios.isCancel(error) || (error as Error)?.name === "CanceledError") {
      throw new Error("Upload was cancelled.", { cause: error });
    }
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        throw new Error(
          "Upload timed out. The microcontroller may have taken too long to write the files.",
          { cause: error }
        );
      }
      const data = error.response?.data as Record<string, unknown> | undefined;
      const serverError =
        (typeof data?.error === "string" && data.error) ||
        (typeof data?.message === "string" && data.message);
      if (serverError) {
        throw new Error(`Microcontroller error: ${serverError}`, { cause: error });
      }
      if (error.message?.includes("Network Error")) {
        throw new Error(
          "Network connection dropped during transfer. Ensure you remain connected to the Signboard Wi-Fi.",
          { cause: error }
        );
      }
    }
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to upload routes package to microcontroller.",
      { cause: error }
    );
  }
}
