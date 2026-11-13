import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import JSZip from "jszip";
import {
  checkHardwareStatus,
  uploadZipToHardware,
  validateAndNormalizePath,
  extractZipForTransfer,
  startTransferSession,
  startTransferFile,
  sendTransferChunk,
  endTransferFile,
  getTransferStatus,
  completeTransferSession,
  cancelTransferSession,
  executeChunkedRouteTransfer,
} from "../services/wifiTransferService";
import { useWifiTransferStore } from "../stores/useWifiTransferStore";

describe("Wi-Fi Transfer Service & Store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useWifiTransferStore.setState({
      pendingPackage: null,
      isCheckingStorage: false,
      isDialogOpen: false,
      hardwareIp: "192.168.4.1",
      hardwareStatus: null,
      isCheckingStatus: false,
      statusError: null,
      extractedFiles: [],
      extractedFolders: [],
      isExtracting: false,
      extractionError: null,
      transferId: "",
      isUploading: false,
      uploadProgress: 0,
      uploadBytesLoaded: 0,
      uploadBytesTotal: 0,
      uploadSuccess: false,
      uploadError: null,
      transferProgress: null,
      transferSummary: null,
      hardwareTransferStatus: null,
      abortController: null,
    });
  });

  describe("checkHardwareStatus", () => {
    it("successfully queries /api/status and parses microcontroller fields matching spec", async () => {
      vi.spyOn(axios, "get").mockResolvedValueOnce({
        data: {
          device_id: "BUS_001",
          esp_firmware: "0.4.1",
          wifi_status: "online",
          wifi_ip: "192.168.4.1",
          storage_status: "ready",
          storage_type: "LittleFS",
          upload_format: "multipart/form-data",
          total_bytes: 1024000,
          used_bytes: 57344,
          free_bytes: 966656,
          max_zip_upload_bytes: 524288,
          upload_in_progress: false,
          last_upload_status: "NOT_YET_TESTED",
          last_saved_file: "",
          stm32_status: "not_connected_in_this_version",
        },
      });

      const status = await checkHardwareStatus("192.168.4.1");

      expect(axios.get).toHaveBeenCalledWith(
        "http://192.168.4.1/api/status",
        expect.objectContaining({ timeout: 5000 })
      );
      expect(status.device_id).toBe("BUS_001");
      expect(status.esp_firmware).toBe("0.4.1");
      expect(status.firmware).toBe("0.4.1");
      expect(status.wifi_status).toBe("online");
      expect(status.wifi_ip).toBe("192.168.4.1");
      expect(status.storage_status).toBe("ready");
      expect(status.storage_type).toBe("LittleFS");
      expect(status.total_bytes).toBe(1024000);
      expect(status.used_bytes).toBe(57344);
      expect(status.free_bytes).toBe(966656);
      expect(status.stm32_status).toBe("not_connected_in_this_version");
    });

    it("falls back to /api/ping if /api/status is not found (404)", async () => {
      vi.spyOn(axios, "get")
        .mockRejectedValueOnce({
          response: { status: 404 },
        })
        .mockResolvedValueOnce({
          data: {
            deviceId: "SB-FALLBACK",
            wifi_status: "ap_mode",
            firmware: "1.0",
            stm32_status: "ok",
            transfer_status: "idle",
          },
        });

      const status = await checkHardwareStatus("http://192.168.4.1/");

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(status.device_id).toBe("SB-FALLBACK");
      expect(status.wifi_status).toBe("ap_mode");
    });

    it("throws a descriptive error when connection fails", async () => {
      vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("Network Error"));

      await expect(checkHardwareStatus("192.168.4.1")).rejects.toThrow(
        /Cannot reach http:\/\/192.168.4.1/
      );
    });
  });

  describe("validateAndNormalizePath", () => {
    it("accepts valid relative paths", () => {
      expect(validateAndNormalizePath("300.mbin")).toEqual({
        valid: true,
        normalizedPath: "300.mbin",
      });
      expect(validateAndNormalizePath("300/route_details.txt")).toEqual({
        valid: true,
        normalizedPath: "300/route_details.txt",
      });
      expect(validateAndNormalizePath("/300/en_0_2_0_2_6_7.bin")).toEqual({
        valid: true,
        normalizedPath: "300/en_0_2_0_2_6_7.bin",
      });
    });

    it("rejects path traversal, empty paths, and FAT-forbidden characters", () => {
      expect(validateAndNormalizePath("")).toEqual({
        valid: false,
        normalizedPath: "",
        error: "Empty path",
      });
      expect(validateAndNormalizePath("../secret.txt").valid).toBe(false);
      expect(validateAndNormalizePath("300/../test.txt").valid).toBe(false);
      expect(validateAndNormalizePath("300/bad*name.txt").valid).toBe(false);
      expect(validateAndNormalizePath("300/colon:name.txt").valid).toBe(false);
    });
  });

  describe("extractZipForTransfer", () => {
    it("extracts files, counts unique folders, and skips macOS metadata", async () => {
      const zip = new JSZip();
      zip.file("300.mbin", "binary root content");
      zip.file("300/route_details.txt", "route details content");
      zip.file("300/en_0_2_0_2_6_7.bin", new Uint8Array([0x01, 0x02, 0x03, 0x04]));
      zip.file("__MACOSX/._300.mbin", "mac os metadata");
      zip.file(".DS_Store", "mac ds store");

      const blob = await zip.generateAsync({ type: "blob" });
      const extracted = await extractZipForTransfer(blob);

      expect(extracted.totalFiles).toBe(3);
      expect(extracted.totalFolders).toBe(1);
      expect(extracted.folders).toEqual(["300"]);
      expect(extracted.files.map((f) => f.path)).toEqual([
        "300.mbin",
        "300/en_0_2_0_2_6_7.bin",
        "300/route_details.txt",
      ]);
      expect(extracted.transferId).toMatch(/^route-upload-/);
    });
  });

  describe("Chunked Transfer API Endpoints", () => {
    it("startTransferSession posts to /api/transfer/start", async () => {
      vi.spyOn(axios, "post").mockResolvedValueOnce({
        data: { success: true, transfer_id: "test-id", status: "STARTED" },
      });

      const res = await startTransferSession("192.168.4.1", {
        transfer_id: "test-id",
        total_files: 2,
        total_folders: 1,
      });

      expect(axios.post).toHaveBeenCalledWith(
        "http://192.168.4.1/api/transfer/start",
        { transfer_id: "test-id", total_files: 2, total_folders: 1 },
        expect.objectContaining({ headers: { "Content-Type": "application/json" } })
      );
      expect(res.status).toBe("STARTED");
    });

    it("startTransferFile posts to /api/transfer/file/start", async () => {
      vi.spyOn(axios, "post").mockResolvedValueOnce({
        data: { success: true, path: "300/route.txt", status: "FILE_READY" },
      });

      const res = await startTransferFile("192.168.4.1", {
        path: "300/route.txt",
        size_bytes: 825,
        file_index: 1,
        total_files: 10,
      });

      expect(axios.post).toHaveBeenCalledWith(
        "http://192.168.4.1/api/transfer/file/start",
        { path: "300/route.txt", size_bytes: 825, file_index: 1, total_files: 10 },
        expect.anything()
      );
      expect(res.status).toBe("FILE_READY");
    });

    it("sendTransferChunk posts raw binary bytes to /api/transfer/file/chunk", async () => {
      vi.spyOn(axios, "post").mockResolvedValueOnce({
        data: {
          success: true,
          chunk_index: 0,
          bytes_received: 512,
          file_bytes_written: 512,
          status: "CHUNK_SAVED",
        },
      });

      const chunkData = new Uint8Array(512);
      const res = await sendTransferChunk("192.168.4.1", 0, 0, chunkData);

      expect(axios.post).toHaveBeenCalledWith(
        "http://192.168.4.1/api/transfer/file/chunk?index=0&offset=0",
        expect.any(ArrayBuffer),
        expect.objectContaining({
          headers: { "Content-Type": "application/octet-stream" },
        })
      );
      expect(res.status).toBe("CHUNK_SAVED");
    });

    it("endTransferFile posts to /api/transfer/file/end", async () => {
      vi.spyOn(axios, "post").mockResolvedValueOnce({
        data: {
          success: true,
          path: "300/route.txt",
          saved_bytes: 825,
          status: "FILE_SAVED",
        },
      });

      const res = await endTransferFile("192.168.4.1", {
        path: "300/route.txt",
        expected_size_bytes: 825,
        expected_chunks: 2,
      });

      expect(axios.post).toHaveBeenCalledWith(
        "http://192.168.4.1/api/transfer/file/end",
        { path: "300/route.txt", expected_size_bytes: 825, expected_chunks: 2 },
        expect.anything()
      );
      expect(res.status).toBe("FILE_SAVED");
    });

    it("getTransferStatus queries /api/transfer/status", async () => {
      vi.spyOn(axios, "get").mockResolvedValueOnce({
        data: {
          success: true,
          transfer_id: "test-id",
          status: "IN_PROGRESS",
          total_files: 10,
          files_started: 2,
          files_saved: 1,
          files_failed: 0,
          current_file: "300/route.txt",
          current_file_bytes: 512,
          current_file_size: 825,
          folders_created: 1,
        },
      });

      const status = await getTransferStatus("192.168.4.1");
      expect(axios.get).toHaveBeenCalledWith(
        "http://192.168.4.1/api/transfer/status",
        expect.anything()
      );
      expect(status.files_saved).toBe(1);
    });

    it("completeTransferSession posts to /api/transfer/complete", async () => {
      vi.spyOn(axios, "post").mockResolvedValueOnce({
        data: { success: true, transfer_id: "test-id", status: "COMPLETED" },
      });

      const res = await completeTransferSession("192.168.4.1", {
        transfer_id: "test-id",
      });
      expect(axios.post).toHaveBeenCalledWith(
        "http://192.168.4.1/api/transfer/complete",
        { transfer_id: "test-id" },
        expect.anything()
      );
      expect(res.status).toBe("COMPLETED");
    });

    it("cancelTransferSession posts to /api/transfer/cancel", async () => {
      vi.spyOn(axios, "post").mockResolvedValueOnce({
        data: { success: true, message: "Transfer cancelled" },
      });

      const res = await cancelTransferSession("192.168.4.1", {
        transfer_id: "test-id",
      });
      expect(axios.post).toHaveBeenCalledWith(
        "http://192.168.4.1/api/transfer/cancel",
        { transfer_id: "test-id" },
        expect.anything()
      );
      expect(res.success).toBe(true);
    });
  });

  describe("executeChunkedRouteTransfer", () => {
    it("executes the complete sequence with back-pressure and confirmation", async () => {
      vi.spyOn(axios, "post").mockImplementation((url) => {
        if (url.includes("/api/transfer/start")) {
          return Promise.resolve({ data: { success: true, status: "STARTED" } });
        }
        if (url.includes("/api/transfer/file/start")) {
          return Promise.resolve({ data: { success: true, status: "FILE_READY" } });
        }
        if (url.includes("/api/transfer/file/chunk")) {
          return Promise.resolve({ data: { success: true, status: "CHUNK_SAVED" } });
        }
        if (url.includes("/api/transfer/file/end")) {
          return Promise.resolve({
            data: { success: true, status: "FILE_SAVED", saved_bytes: 600 },
          });
        }
        if (url.includes("/api/transfer/complete")) {
          return Promise.resolve({ data: { success: true, status: "COMPLETED" } });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const files = [
        {
          id: "300/route.txt",
          path: "300/route.txt",
          sizeBytes: 600,
          chunksTotal: 2,
          chunksSent: 0,
          status: "pending" as const,
          data: new Uint8Array(600),
        },
      ];

      const summary = await executeChunkedRouteTransfer({
        ipOrUrl: "192.168.4.1",
        transferId: "route-upload-test-01",
        files,
        totalFolders: 1,
      });

      expect(summary.totalFiles).toBe(1);
      expect(summary.filesSaved).toBe(1);
      expect(summary.filesFailed).toBe(0);
      expect(summary.foldersCreated).toBe(1);
      expect(files[0].status).toBe("saved");
    });
  });

  describe("uploadZipToHardware (legacy)", () => {
    it("uploads blob via multipart/form-data with progress reporting", async () => {
      let progressCallback:
        | ((progressEvent: { loaded: number; total: number }) => void)
        | undefined = undefined;
      vi.spyOn(axios, "post").mockImplementationOnce((_url, _data, config) => {
        progressCallback = (config as { onUploadProgress?: (ev: { loaded: number; total: number }) => void })
          ?.onUploadProgress;
        if (progressCallback) {
          progressCallback({ loaded: 500, total: 1000 });
          progressCallback({ loaded: 1000, total: 1000 });
        }
        return Promise.resolve({
          data: { success: true, message: "Package extracted" },
        });
      });

      const onProgressSpy = vi.fn();
      const mockBlob = new Blob(["fake zip bytes"], { type: "application/zip" });

      const response = await uploadZipToHardware({
        ipOrUrl: "192.168.4.1",
        blob: mockBlob,
        filename: "test.zip",
        onProgress: onProgressSpy,
      });

      expect(axios.post).toHaveBeenCalledWith(
        "http://192.168.4.1/api/upload",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );

      expect(onProgressSpy).toHaveBeenCalledWith(50, 500, 1000);
      expect(onProgressSpy).toHaveBeenCalledWith(100, 1000, 1000);
      expect(response.success).toBe(true);
    });
  });

  describe("useWifiTransferStore", () => {
    it("updates hardware IP and resets status", () => {
      const store = useWifiTransferStore.getState();
      store.setHardwareIp("192.168.4.50");

      expect(useWifiTransferStore.getState().hardwareIp).toBe("192.168.4.50");
      expect(useWifiTransferStore.getState().hardwareStatus).toBeNull();
    });

    it("resets upload state cleanly", () => {
      useWifiTransferStore.setState({
        uploadProgress: 80,
        uploadBytesLoaded: 800,
        uploadBytesTotal: 1000,
        uploadSuccess: true,
        uploadError: "Previous error",
      });

      useWifiTransferStore.getState().resetUploadState();

      const state = useWifiTransferStore.getState();
      expect(state.uploadProgress).toBe(0);
      expect(state.uploadBytesLoaded).toBe(0);
      expect(state.uploadBytesTotal).toBe(0);
      expect(state.uploadSuccess).toBe(false);
      expect(state.uploadError).toBeNull();
    });

    it("retries a single failed file successfully and updates store", async () => {
      vi.spyOn(axios, "post").mockImplementation((url) => {
        if (url.includes("/api/transfer/start")) {
          return Promise.resolve({ data: { success: true, status: "STARTED" } });
        }
        if (url.includes("/api/transfer/file/start")) {
          return Promise.resolve({ data: { success: true, status: "FILE_READY" } });
        }
        if (url.includes("/api/transfer/file/chunk")) {
          return Promise.resolve({ data: { success: true, status: "CHUNK_SAVED" } });
        }
        if (url.includes("/api/transfer/file/end")) {
          return Promise.resolve({
            data: { success: true, status: "FILE_SAVED", saved_bytes: 400 },
          });
        }
        if (url.includes("/api/transfer/complete")) {
          return Promise.resolve({ data: { success: true, status: "COMPLETED" } });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      useWifiTransferStore.setState({
        hardwareIp: "192.168.4.1",
        extractedFiles: [
          {
            id: "300/route.txt",
            path: "300/route.txt",
            sizeBytes: 400,
            chunksTotal: 1,
            chunksSent: 0,
            status: "failed",
            error: "stm32_timeout",
            data: new Uint8Array(400),
          },
        ],
        transferSummary: {
          transferId: "initial-test",
          totalFiles: 1,
          filesSaved: 0,
          filesFailed: 1,
          foldersCreated: 1,
          totalBytes: 400,
          bytesTransferred: 0,
          durationMs: 100,
          failedFiles: [{ path: "300/route.txt", error: "stm32_timeout" }],
        },
      });

      const success = await useWifiTransferStore.getState().retrySingleFile("300/route.txt");

      expect(success).toBe(true);
      const state = useWifiTransferStore.getState();
      expect(state.extractedFiles[0].status).toBe("saved");
      expect(state.extractedFiles[0].error).toBeUndefined();
      expect(state.transferSummary?.filesSaved).toBe(1);
      expect(state.transferSummary?.filesFailed).toBe(0);
      expect(state.transferSummary?.failedFiles).toHaveLength(0);
      expect(state.uploadSuccess).toBe(true);
    });

    it("retries all failed files in batch", async () => {
      vi.spyOn(axios, "post").mockImplementation((url) => {
        if (url.includes("/api/transfer/start")) {
          return Promise.resolve({ data: { success: true, status: "STARTED" } });
        }
        if (url.includes("/api/transfer/file/start")) {
          return Promise.resolve({ data: { success: true, status: "FILE_READY" } });
        }
        if (url.includes("/api/transfer/file/chunk")) {
          return Promise.resolve({ data: { success: true, status: "CHUNK_SAVED" } });
        }
        if (url.includes("/api/transfer/file/end")) {
          return Promise.resolve({
            data: { success: true, status: "FILE_SAVED", saved_bytes: 500 },
          });
        }
        if (url.includes("/api/transfer/complete")) {
          return Promise.resolve({ data: { success: true, status: "COMPLETED" } });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      useWifiTransferStore.setState({
        hardwareIp: "192.168.4.1",
        extractedFiles: [
          {
            id: "300.mbin",
            path: "300.mbin",
            sizeBytes: 500,
            chunksTotal: 1,
            chunksSent: 1,
            status: "saved",
            data: new Uint8Array(500),
          },
          {
            id: "300/route.txt",
            path: "300/route.txt",
            sizeBytes: 500,
            chunksTotal: 1,
            chunksSent: 0,
            status: "failed",
            error: "chunk_out_of_order",
            data: new Uint8Array(500),
          },
        ],
        transferSummary: {
          transferId: "batch-test",
          totalFiles: 2,
          filesSaved: 1,
          filesFailed: 1,
          foldersCreated: 1,
          totalBytes: 1000,
          bytesTransferred: 500,
          durationMs: 200,
          failedFiles: [{ path: "300/route.txt", error: "chunk_out_of_order" }],
        },
      });

      const success = await useWifiTransferStore.getState().retryFailedFiles();

      expect(success).toBe(true);
      const state = useWifiTransferStore.getState();
      expect(state.extractedFiles[1].status).toBe("saved");
      expect(state.transferSummary?.filesSaved).toBe(2);
      expect(state.transferSummary?.filesFailed).toBe(0);
      expect(state.uploadSuccess).toBe(true);
    });
  });
});
