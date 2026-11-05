import JSZip from "jszip";
import { saveAs } from "file-saver";

export interface IExportAudioItem {
  url: string;
  fileName: string;
  folder?: string;
}

export interface IExportProgress {
  current: number;
  total: number;
  percent: number;
}

/**
 * Downloads a list of audio files from their public URLs and packages them into a ZIP archive.
 */
export async function exportAudiosToZip(
  items: IExportAudioItem[],
  zipFilename: string,
  onProgress?: (progress: IExportProgress) => void
): Promise<{ count: number; zipName: string }> {
  const validItems = items.filter((item) => Boolean(item.url?.trim()));

  if (validItems.length === 0) {
    throw new Error("No available audio recordings to export.");
  }

  const zip = new JSZip();
  let completed = 0;
  const total = validItems.length;

  const usedPaths = new Set<string>();
  const poolLimit = 5;
  const queue = [...validItems];

  const workers = Array.from(
    { length: Math.min(poolLimit, queue.length) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item || !item.url) continue;

        try {
          const response = await fetch(item.url);
          if (!response.ok) {
            console.warn(
              `[audioExport] HTTP ${response.status} when fetching audio: ${item.url}`
            );
            continue;
          }

          const blob = await response.blob();
          if (blob.size === 0) {
            console.warn(`[audioExport] Empty audio response from ${item.url}`);
            continue;
          }

          // Compute target path inside the ZIP
          const cleanName = item.fileName.trim().replace(/[\\/:]/g, "-");
          let targetPath = item.folder
            ? `${item.folder.trim().replace(/[\\/:]/g, "-")}/${cleanName}`
            : cleanName;

          // Prevent file name collisions within the archive
          if (usedPaths.has(targetPath)) {
            const extIdx = targetPath.lastIndexOf(".");
            const base = extIdx !== -1 ? targetPath.slice(0, extIdx) : targetPath;
            const ext = extIdx !== -1 ? targetPath.slice(extIdx) : "";
            let counter = 1;
            while (usedPaths.has(`${base}_${counter}${ext}`)) {
              counter++;
            }
            targetPath = `${base}_${counter}${ext}`;
          }
          usedPaths.add(targetPath);

          zip.file(targetPath, blob);
        } catch (err) {
          console.warn(`[audioExport] Error downloading ${item.url}:`, err);
        } finally {
          completed++;
          if (onProgress) {
            onProgress({
              current: completed,
              total,
              percent: Math.round((completed / total) * 100),
            });
          }
        }
      }
    }
  );

  await Promise.all(workers);

  const fileCount = Object.keys(zip.files).length;
  if (fileCount === 0) {
    throw new Error("Unable to download audio files from storage.");
  }

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const finalZipName = zipFilename.endsWith(".zip")
    ? zipFilename
    : `${zipFilename}.zip`;

  saveAs(zipBlob, finalZipName);

  return { count: fileCount, zipName: finalZipName };
}

