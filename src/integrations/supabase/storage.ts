import { supabase } from "./client";

export const STORAGE_BUCKETS = {
  AUDIOS: "audios",
  STOPS: "stops",
} as const;

export interface UploadResult {
  fileUrl: string;
  size: number;
}

export async function uploadStopAudioFile(
  file: File,
  stopId: string
): Promise<UploadResult> {
  const filePath = `${stopId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.STOPS)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload audio file to storage: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKETS.STOPS)
    .getPublicUrl(filePath);

  return {
    fileUrl: urlData.publicUrl,
    size: file.size,
  };
}

export async function uploadGenericAudio(
  file: File,
  folderPath: string
): Promise<UploadResult> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${folderPath}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.AUDIOS)
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`Failed to upload audio to bucket: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from(STORAGE_BUCKETS.AUDIOS)
    .getPublicUrl(filePath);

  return {
    fileUrl: data.publicUrl,
    size: file.size,
  };
}

export async function deleteStopAudioFile(
  fileUrl: string,
  stopId: string
): Promise<void> {
  const path = fileUrl.split("/").pop();
  if (!path) return;

  const { error: deleteError } = await supabase.storage
    .from(STORAGE_BUCKETS.STOPS)
    .remove([`${stopId}/${path}`]);

  if (deleteError) {
    throw new Error(`Failed to delete audio file: ${deleteError.message}`);
  }
}

