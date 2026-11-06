import axios from "axios";
import type {
  IMicrocontrollerStatus,
  IHardwareUploadResponse,
} from "../types/wifiTransfer";

const DEFAULT_TIMEOUT_MS = 60000;
const STATUS_TIMEOUT_MS = 5000;

function formatBaseUrl(ipOrUrl: string): string {
  let cleaned = ipOrUrl.trim();
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = `http://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, "");
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
    const response = await axios.get<IMicrocontrollerStatus>(`${baseUrl}/api/status`, {
      timeout: STATUS_TIMEOUT_MS,
      headers: {
        Accept: "application/json",
      },
    });

    const data = response.data || ({} as any);
    return {
      ...data,
      device_id: data.device_id || data.deviceId || "Unknown Device",
      wifi_status: data.wifi_status || data.wifiStatus || "connected",
      frimware: data.frimware || data.firmware || data.firmwareVersion || "Unknown",
      stm32_status: data.stm32_status || data.stm32Status || "ready",
      transfer_status: data.transfer_status || data.transferStatus || "idle",
    };
  } catch (error: any) {
    // If 404, attempt fallback to /api/ping
    if (error?.response?.status === 404) {
      const pingResponse = await axios.get<any>(`${baseUrl}/api/ping`, {
        timeout: STATUS_TIMEOUT_MS,
      });
      const data = pingResponse.data || {};
      return {
        ...data,
        device_id: data.device_id || data.deviceId || "Device",
        wifi_status: data.wifi_status || "ready",
        frimware: data.frimware || data.firmware || "1.0",
        stm32_status: data.stm32_status || "ready",
        transfer_status: data.transfer_status || "idle",
      };
    }

    if (error?.code === "ECONNABORTED") {
      throw new Error(`Connection to ${baseUrl} timed out. Verify your Wi-Fi is connected to the Signboard.`);
    }
    if (error?.message?.includes("Network Error")) {
      throw new Error(
        `Cannot reach ${baseUrl}. Please ensure you are connected to the Signboard's Wi-Fi hotspot.`
      );
    }
    throw new Error(error?.response?.data?.error || error?.message || "Failed to communicate with microcontroller.");
  }
}

/**
 * Uploads the route ZIP binary blob to the microcontroller via /api/upload.
 * Supports real-time upload progress percentage tracking.
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
  } catch (error: any) {
    if (axios.isCancel(error) || error?.name === "CanceledError") {
      throw new Error("Upload was cancelled.");
    }
    if (error?.code === "ECONNABORTED") {
      throw new Error("Upload timed out. The microcontroller may have taken too long to write the files.");
    }
    const serverError = error?.response?.data?.error || error?.response?.data?.message;
    if (serverError) {
      throw new Error(`Microcontroller error: ${serverError}`);
    }
    if (error?.message?.includes("Network Error")) {
      throw new Error("Network connection dropped during transfer. Ensure you remain connected to the Signboard Wi-Fi.");
    }
    throw new Error(error?.message || "Failed to upload routes package to microcontroller.");
  }
}
