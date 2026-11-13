export interface IPendingSignboardZip {
  id: "current_package";
  blob: Blob;
  filename: string;
  format: "v1" | "v2";
  routeCount: number;
  sizeBytes: number;
  createdAt: string;
  organizationId?: string;
  depotId?: string;
}

/**
 * Hardware status reported by the ESP8266 microcontroller via GET /api/status.
 * Example response:
 * {
 *   "device_id": "BUS_001",
 *   "esp_firmware": "0.4.1",
 *   "wifi_status": "online",
 *   "wifi_ip": "192.168.4.1",
 *   "storage_status": "ready",
 *   "storage_type": "LittleFS",
 *   "upload_format": "multipart/form-data",
 *   "total_bytes": 1024000,
 *   "used_bytes": 57344,
 *   "free_bytes": 966656,
 *   "max_zip_upload_bytes": 524288,
 *   "upload_in_progress": false,
 *   "last_upload_status": "NOT_YET_TESTED",
 *   "last_saved_file": "",
 *   "stm32_status": "not_connected_in_this_version"
 * }
 */
export interface IMicrocontrollerStatus {
  device_id: string;
  esp_firmware?: string;
  firmware?: string;
  frimware?: string; // backwards compatibility with legacy spelling
  wifi_status: string;
  wifi_ip?: string;
  storage_status?: string;
  storage_type?: string;
  upload_format?: string;
  total_bytes?: number;
  used_bytes?: number;
  free_bytes?: number;
  max_zip_upload_bytes?: number;
  upload_in_progress?: boolean;
  last_upload_status?: string;
  last_saved_file?: string;
  stm32_status: string;
  transfer_status?: string;
  [key: string]: unknown;
}

/** Legacy response type kept for backwards compatibility */
export interface IHardwareUploadResponse {
  success: boolean;
  message?: string;
  routeCount?: number;
  [key: string]: unknown;
}

// ============================================================================
// Navitronix PIS - Route File Transfer API Specification v1.0
// ============================================================================

export interface ITransferStartRequest {
  transfer_id: string;
  total_files: number;
  total_folders: number;
}

export interface ITransferStartResponse {
  success: boolean;
  transfer_id: string;
  status: "STARTED" | string;
  error?: string;
  message?: string;
}

export interface IFileStartRequest {
  path: string;
  size_bytes: number;
  file_index: number;
  total_files: number;
}

export interface IFileStartResponse {
  success: boolean;
  path: string;
  status: "FILE_READY" | string;
  error?: string;
  message?: string;
}

export interface IFileChunkResponse {
  success: boolean;
  chunk_index: number;
  bytes_received: number;
  file_bytes_written: number;
  status: "CHUNK_SAVED" | string;
  error?: string;
  message?: string;
}

export interface IFileEndRequest {
  path: string;
  expected_size_bytes: number;
  expected_chunks: number;
}

export interface IFileEndResponse {
  success: boolean;
  path: string;
  saved_bytes: number;
  status: "FILE_SAVED" | string;
  error?: string;
  message?: string;
}

export interface ITransferStatusResponse {
  success: boolean;
  transfer_id: string;
  status: "STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ERROR" | string;
  total_files: number;
  files_started: number;
  files_saved: number;
  files_failed: number;
  current_file: string;
  current_file_bytes: number;
  current_file_size: number;
  folders_created: number;
  error?: string;
  message?: string;
}

export interface ITransferCompleteRequest {
  transfer_id: string;
}

export interface ITransferCompleteResponse {
  success: boolean;
  transfer_id?: string;
  status?: string;
  total_files?: number;
  files_saved?: number;
  files_failed?: number;
  folders_created?: number;
  error?: string;
  message?: string;
}

export interface ITransferCancelRequest {
  transfer_id: string;
}

export interface ITransferCancelResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ITransferErrorResponse {
  success: false;
  error:
    | "transfer_busy"
    | "invalid_path"
    | "file_too_large"
    | "file_not_open"
    | "chunk_out_of_order"
    | "chunk_offset_mismatch"
    | "sd_not_mounted"
    | "sd_write_failed"
    | "stm32_timeout"
    | "transfer_incomplete"
    | string;
  message: string;
  retryable?: boolean;
}

export type FileTransferState = "pending" | "transferring" | "saved" | "failed";

export interface ITransferFileItem {
  id: string;
  path: string;
  sizeBytes: number;
  chunksTotal: number;
  chunksSent: number;
  bytesLoaded?: number;
  status: FileTransferState;
  data: Uint8Array;
  error?: string;
}

export interface ITransferSummary {
  transferId: string;
  totalFiles: number;
  filesSaved: number;
  filesFailed: number;
  foldersCreated: number;
  totalBytes: number;
  bytesTransferred: number;
  durationMs: number;
  failedFiles: Array<{ path: string; error: string }>;
}

export interface ITransferProgress {
  currentFileIndex: number;
  totalFiles: number;
  currentFilePath: string;
  currentFileSize: number;
  currentFileLoaded: number;
  currentChunkIndex: number;
  currentTotalChunks: number;
  overallBytesLoaded: number;
  overallBytesTotal: number;
  percentage: number;
  statusMessage: string;
}
