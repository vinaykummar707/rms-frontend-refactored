import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import {
  checkHardwareStatus,
  uploadZipToHardware,
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
      isUploading: false,
      uploadProgress: 0,
      uploadBytesLoaded: 0,
      uploadBytesTotal: 0,
      uploadSuccess: false,
      uploadError: null,
    });
  });

  describe("checkHardwareStatus", () => {
    it("successfully queries /api/status and parses microcontroller fields", async () => {
      vi.spyOn(axios, "get").mockResolvedValueOnce({
        data: {
          device_id: "SB-2045",
          wifi_status: "ready",
          frimware: "3.2.0",
          stm32_status: "ready",
          transfer_status: "idle",
        },
      });

      const status = await checkHardwareStatus("192.168.4.1");

      expect(axios.get).toHaveBeenCalledWith(
        "http://192.168.4.1/api/status",
        expect.objectContaining({ timeout: 5000 })
      );
      expect(status.device_id).toBe("SB-2045");
      expect(status.wifi_status).toBe("ready");
      expect(status.frimware).toBe("3.2.0");
      expect(status.stm32_status).toBe("ready");
      expect(status.transfer_status).toBe("idle");
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

  describe("uploadZipToHardware", () => {
    it("uploads blob via multipart/form-data with progress reporting", async () => {
      let progressCallback: any = null;
      vi.spyOn(axios, "post").mockImplementationOnce((_url, _data, config: any) => {
        progressCallback = config?.onUploadProgress;
        if (progressCallback) {
          progressCallback({ loaded: 500, total: 1000 });
          progressCallback({ loaded: 1000, total: 1000 });
        }
        return Promise.resolve({
          data: { success: true, message: "Package extracted" },
        }) as any;
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
  });
});
