import { saveAs } from "file-saver";
import JSZip from "jszip";

/**
 * Saves the export ZIP blob as a direct file download.
 */
export async function writeZipToDirectoryOrFallback(
  blob: Blob,
  fallbackZipName: string
): Promise<{ success: boolean; savedAsFolder: boolean }> {
  saveAs(blob, fallbackZipName);
  return { success: true, savedAsFolder: false };
}

export const EXPORT_BATCH_SIZE = 10;

/**
 * Builds a human-readable message from an export request failure.
 */
export async function getExportErrorMessage(error: any): Promise<string> {
  const response = error?.response;
  if (!response) {
    if (!error?.isAxiosError) {
      return error?.message || "Unexpected error while preparing the export file.";
    }
    if (error?.code === "ECONNABORTED") {
      return "The export server took too long to respond. Please try again.";
    }
    return "Could not reach the export server. Check your network connection and try again.";
  }

  let serverMessage = "";
  const data = response.data;
  try {
    const text =
      data instanceof Blob
        ? await data.text()
        : typeof data === "string"
        ? data
        : JSON.stringify(data ?? "");
    try {
      const parsed = JSON.parse(text);
      serverMessage = parsed?.message || parsed?.error || parsed?.title || "";
    } catch {
      serverMessage = text;
    }
  } catch {
    serverMessage = "";
  }
  serverMessage = serverMessage.trim().slice(0, 300);

  const status = response.status;
  const reason =
    status === 400
      ? "The server rejected the route data"
      : status === 401 || status === 403
      ? "You are not authorized to export these routes"
      : status === 404
      ? "The export service was not found"
      : status === 413
      ? "Too much route data in one request"
      : status >= 500
      ? "The export server encountered an error"
      : `Request failed (HTTP ${status})`;

  return serverMessage ? `${reason}: ${serverMessage}` : `${reason} (HTTP ${status}).`;
}

/**
 * Posts routes to the export API in batches and merges the returned ZIPs into one.
 */
export async function exportRoutesInBatches<T>(
  routes: T[],
  postBatch: (batch: T[]) => Promise<Blob>,
  batchSize: number = EXPORT_BATCH_SIZE
): Promise<Blob> {
  if (routes.length <= batchSize) return postBatch(routes);

  const merged = new JSZip();
  for (let start = 0, part = 1; start < routes.length; start += batchSize, part++) {
    const batchZip = await JSZip.loadAsync(
      await postBatch(routes.slice(start, start + batchSize))
    );
    for (const entry of Object.values(batchZip.files)) {
      if (entry.dir) continue;
      const data = await entry.async("uint8array");
      merged.file(
        merged.file(entry.name) ? `part-${part}/${entry.name}` : entry.name,
        data
      );
    }
  }
  return merged.generateAsync({ type: "blob" });
}

