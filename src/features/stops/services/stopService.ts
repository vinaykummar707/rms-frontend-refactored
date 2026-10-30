import { supabase } from "@/integrations/supabase/client";
import { deleteStopAudioFile } from "@/integrations/supabase/storage";
import { handleStopAudioGeneration } from "@/shared/utils/ttsUtils";
import type { IStop, IStopWithAudio, IStopCreate } from "@/shared/types/stop";

/**
 * Generates an audio announcement file for a stop using Sarvam TTS and saves it in Supabase
 */
export async function generateStopAudio(
  text: string,
  stopId: string,
  languageCode: string = "en-IN",
  voice: string = "meera"
) {
  if (!text.trim() || !stopId) {
    throw new Error("Text and stopId are required for audio generation");
  }
  return await handleStopAudioGeneration(text, stopId, languageCode, voice);
}

/**
 * Deletes a stop audio record from the stop_audios table
 */
export async function deleteStopAudioRecord(stopAudioId: string): Promise<void> {
  const { error } = await supabase
    .from("stop_audios")
    .delete()
    .match({ id: stopAudioId });

  if (error) {
    throw new Error(`Failed to delete stop audio: ${error.message}`);
  }
}

/**
 * Deletes an audio file from the Supabase storage bucket
 */
export async function deleteAudioStorageFile(fileUrl: string, stopId: string): Promise<void> {
  const fileName = fileUrl.split("/").pop();
  if (!fileName) {
    throw new Error("Invalid audio file URL");
  }
  await deleteStopAudioFile(stopId, fileName);
}

/**
 * Deletes both storage file and database record for a stop audio
 */
export async function deleteAudioFileAndRecord(
  fileUrl: string,
  stopId: string,
  stopAudioId?: string
): Promise<void> {
  if (fileUrl) {
    try {
      await deleteAudioStorageFile(fileUrl, stopId);
    } catch (err) {
      console.warn("Storage deletion warning:", err);
    }
  }

  if (stopAudioId) {
    await deleteStopAudioRecord(stopAudioId);
  }
}

/**
 * Cascades stop deletion: removes audio file, audio record, and stop record
 */
export async function deleteStopCascade(
  stopId: string,
  fileUrl?: string,
  stopAudioId?: string
): Promise<void> {
  if (fileUrl) {
    await deleteAudioFileAndRecord(fileUrl, stopId, stopAudioId);
  } else if (stopAudioId) {
    await deleteStopAudioRecord(stopAudioId);
  }

  const { error } = await supabase.from("stops").delete().match({ id: stopId });
  if (error) {
    throw new Error(`Failed to delete stop: ${error.message}`);
  }
}

/**
 * Bulk generates audio for a list of stops
 */
export async function generateBulkStopAudio(
  stops: IStopWithAudio[],
  onProgress?: (current: number, total: number) => void
): Promise<{ successCount: number; total: number; failed: string[] }> {
  let successCount = 0;
  const failed: string[] = [];

  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    onProgress?.(i + 1, stops.length);
    try {
      if (s.name && s.id) {
        await handleStopAudioGeneration(s.name, s.id);
        successCount++;
      }
    } catch (e: any) {
      console.warn(`Failed audio generation for ${s.name}:`, e);
      failed.push(s.name);
    }
  }

  return { successCount, total: stops.length, failed };
}

/**
 * Bulk deletes all stops belonging to a depot
 */
export async function deleteAllStopsForDepot(depotId: string): Promise<void> {
  const { error } = await supabase.from("stops").delete().eq("depot_id", depotId);
  if (error) {
    throw new Error(`Failed to delete all stops: ${error.message}`);
  }
}

/**
 * Generates CSV string for stops
 */
export function exportStopsToCSV(stops: IStop[]): string {
  const headers = [
    "Stop Name",
    "Kannada Name",
    "Down Latitude",
    "Down Longitude",
    "Up Latitude",
    "Up Longitude",
  ];

  const rows = stops.map((s) => [
    `"${(s.name || "").replace(/"/g, '""')}"`,
    `"${((s as any).name_kn || "").replace(/"/g, '""')}"`,
    s.down_latitude ?? "",
    s.down_longitude ?? "",
    s.up_latitude ?? "",
    s.up_longitude ?? "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Parses stops from CSV content
 */
export function parseStopsFromCSV(
  csvText: string,
  depotId: string,
  organizationId: string
): IStopCreate[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV file contains no records");
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const nameIndex = headers.findIndex((h) => h.includes("stop name") || h === "name");
  const nameKnIndex = headers.findIndex((h) => h.includes("kannada"));
  const downLatIndex = headers.findIndex((h) => h.includes("down latitude") || h === "down_lat");
  const downLonIndex = headers.findIndex((h) => h.includes("down longitude") || h === "down_lon");
  const upLatIndex = headers.findIndex((h) => h.includes("up latitude") || h === "up_lat");
  const upLonIndex = headers.findIndex((h) => h.includes("up longitude") || h === "up_lon");

  if (nameIndex === -1) {
    throw new Error("CSV must contain a 'Stop Name' column");
  }

  const stopsToInsert: IStopCreate[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row =
      lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((val) => val.replace(/^"|"$/g, "").trim()) ||
      lines[i].split(",").map((v) => v.trim());
    const name = row[nameIndex];
    if (!name) continue;

    stopsToInsert.push({
      name,
      name_kn: nameKnIndex !== -1 ? row[nameKnIndex] || undefined : undefined,
      down_latitude: downLatIndex !== -1 && row[downLatIndex] ? row[downLatIndex] : undefined,
      down_longitude: downLonIndex !== -1 && row[downLonIndex] ? row[downLonIndex] : undefined,
      up_latitude: upLatIndex !== -1 && row[upLatIndex] ? row[upLatIndex] : undefined,
      up_longitude: upLonIndex !== -1 && row[upLonIndex] ? row[upLonIndex] : undefined,
      depot_id: depotId,
      organization_id: organizationId,
    });
  }

  if (stopsToInsert.length === 0) {
    throw new Error("No valid stops found in CSV");
  }

  return stopsToInsert;
}

/**
 * Imports parsed stops from CSV and inserts into database
 */
export async function importStopsFromCSV(
  csvText: string,
  depotId: string,
  organizationId: string
): Promise<number> {
  const stopsToInsert = parseStopsFromCSV(csvText, depotId, organizationId);
  const { error } = await supabase.from("stops").insert(stopsToInsert);
  if (error) throw error;
  return stopsToInsert.length;
}

