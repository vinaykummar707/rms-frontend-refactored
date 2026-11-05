import { supabase } from "@/integrations/supabase/client";
import { STORAGE_BUCKETS } from "@/integrations/supabase/storage";
import {
  synthesizeEdgeTts,
  type SynthesizeOptions,
} from "@/features/stops/services/edgeTtsService";
import type {
  IStageAudio,
  IStageAudioCreate,
  IStageAudioUpdate,
  StageType,
} from "@/shared/types/stageAudio";
import { STAGE_TYPES } from "@/shared/types/stageAudio";

/**
 * Creates a URL/filesystem safe slug for storage filenames
 */
export function slugifyText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/**
 * Checks if a stage audio record for the same language and stage_type already exists.
 * In edit mode, excludeId skips the current record.
 */
export async function checkStageAudioDuplicate(
  language: string,
  stageType: StageType,
  excludeId?: string
): Promise<boolean> {
  const trimmedLang = language.trim().toLowerCase();
  const trimmedStage = stageType.trim().toLowerCase();

  let query = supabase
    .from("stage_audios")
    .select("id, language, stage_type");

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[stageAudioService] Duplicate check error:", error);
    return false;
  }

  return (data || []).some(
    (a: any) =>
      a.language?.trim().toLowerCase() === trimmedLang &&
      a.stage_type?.trim().toLowerCase() === trimmedStage
  );
}

/**
 * Synthesizes audio using Microsoft Edge-TTS from announcementText,
 * and names the resulting File using the Reference Title / Stage as prefix.
 * Announcement text is strictly spoken and never used as the file prefix.
 */
export async function generateStageAudioFile(
  announcementText: string,
  referenceText: string,
  stageType: StageType,
  options: SynthesizeOptions = {}
): Promise<File> {
  const trimmedAnnouncement = announcementText.trim();
  const trimmedReference = referenceText.trim();

  if (!trimmedAnnouncement) {
    throw new Error("Announcement speech text cannot be empty.");
  }

  const { blob } = await synthesizeEdgeTts(trimmedAnnouncement, options);

  const prefix = slugifyText(trimmedReference) || stageType;
  const fileName = `${prefix}-${Date.now()}.mp3`;

  return new File([blob], fileName, { type: "audio/mpeg" });
}

/**
 * Uploads a stage audio file to Supabase Storage in the 'stage-audios' bucket
 * and records its metadata in the 'stage_audios' table.
 */
export async function uploadStageAudioFile(
  file: File,
  language: string,
  stageType: StageType,
  referenceText: string,
  metadata: {
    announcementText: string;
    stageLabel?: string;
    voice?: string;
    speed?: string;
    createdBy?: string;
  }
): Promise<IStageAudio> {
  const trimmedLang = language.trim();
  const trimmedRefText = referenceText.trim();
  const trimmedAnnounceText = metadata.announcementText.trim();

  if (!trimmedLang) {
    throw new Error("Language code is required for stage audio.");
  }
  if (!trimmedRefText) {
    throw new Error("Reference text is required for stage audio.");
  }
  if (!trimmedAnnounceText) {
    throw new Error("Announcement speech text is required.");
  }

  const isDuplicate = await checkStageAudioDuplicate(trimmedLang, stageType);
  if (isDuplicate) {
    throw new Error(
      `An audio announcement for stage "${stageType}" in language "${trimmedLang}" already exists.`
    );
  }

  const stageMeta = STAGE_TYPES.find((s) => s.type === stageType);
  const stageLabel = metadata.stageLabel || stageMeta?.label || stageType;

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const slug = slugifyText(trimmedRefText) || stageType;
  const targetFileName = `${slug}.${ext}`;
  const uniqueStorageName = `${Date.now()}-${slug}.${ext}`;
  const storagePath = `${trimmedLang}/${uniqueStorageName}`;

  // 1. Upload file to 'stage-audios' bucket
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.STAGE_AUDIOS)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || (ext === "wav" ? "audio/wav" : "audio/mpeg"),
    });

  if (uploadError) {
    console.error("[stageAudioService] Storage upload failed:", uploadError);
    throw new Error(`Failed to upload stage audio to storage: ${uploadError.message}`);
  }

  // 2. Obtain Public Streaming URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKETS.STAGE_AUDIOS)
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // 3. Insert record into 'stage_audios' table
  const payload: IStageAudioCreate = {
    language: trimmedLang,
    stage_type: stageType,
    stage_label: stageLabel,
    reference_text: trimmedRefText,
    announcement_text: trimmedAnnounceText,
    file_name: targetFileName,
    file_size: file.size,
    file_format: file.type || (ext === "wav" ? "audio/wav" : "audio/mpeg"),
    url: publicUrl,
    storage_path: storagePath,
    voice: metadata.voice || "en-IN-NeerjaNeural",
    speed: metadata.speed || "-4%",
    created_by: metadata.createdBy || null,
  };

  const { data, error: dbError } = await supabase
    .from("stage_audios")
    .insert(payload)
    .select()
    .single();

  if (dbError) {
    console.error("[stageAudioService] Database insert failed:", dbError);
    // Cleanup orphaned file from storage
    try {
      await supabase.storage.from(STORAGE_BUCKETS.STAGE_AUDIOS).remove([storagePath]);
    } catch (cleanupErr) {
      console.warn("[stageAudioService] Cleanup error:", cleanupErr);
    }
    throw new Error(`Failed to save stage audio record: ${dbError.message}`);
  }

  return data as IStageAudio;
}

/**
 * Updates an existing stage audio record. If a new audio file is provided,
 * uploads replacement and cleans up the prior storage asset.
 */
export async function updateStageAudio(
  id: string,
  updates: {
    referenceText: string;
    announcementText: string;
    file?: File | null;
    language?: string;
    stageType?: StageType;
    voice?: string;
    speed?: string;
  },
  existingAudio?: IStageAudio
): Promise<IStageAudio> {
  const trimmedRefText = updates.referenceText.trim();
  const trimmedAnnounceText = updates.announcementText.trim();

  if (!trimmedRefText) {
    throw new Error("Reference text is required.");
  }
  if (!trimmedAnnounceText) {
    throw new Error("Announcement speech text is required.");
  }

  const payload: IStageAudioUpdate = {
    id,
    reference_text: trimmedRefText,
    announcement_text: trimmedAnnounceText,
    voice: updates.voice,
    speed: updates.speed,
  };

  if (updates.file) {
    const ext = updates.file.name.split(".").pop()?.toLowerCase() || "mp3";
    const slug = slugifyText(trimmedRefText) || "stage";
    const targetFileName = `${slug}.${ext}`;
    const lang = updates.language || existingAudio?.language || "en-IN";
    const uniqueStorageName = `${Date.now()}-${slug}.${ext}`;
    const storagePath = `${lang}/${uniqueStorageName}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.STAGE_AUDIOS)
      .upload(storagePath, updates.file, {
        cacheControl: "3600",
        upsert: true,
        contentType: updates.file.type || (ext === "wav" ? "audio/wav" : "audio/mpeg"),
      });

    if (uploadError) {
      throw new Error(`Failed to upload replacement audio: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKETS.STAGE_AUDIOS)
      .getPublicUrl(storagePath);

    payload.file_name = targetFileName;
    payload.file_size = updates.file.size;
    payload.file_format = updates.file.type || (ext === "wav" ? "audio/wav" : "audio/mpeg");
    payload.url = urlData.publicUrl;
    payload.storage_path = storagePath;

    // Delete previous file from storage
    if (existingAudio?.storage_path && existingAudio.storage_path !== storagePath) {
      try {
        await supabase.storage
          .from(STORAGE_BUCKETS.STAGE_AUDIOS)
          .remove([existingAudio.storage_path]);
      } catch (delErr) {
        console.warn("[stageAudioService] Old file removal warning:", delErr);
      }
    }
  }

  const { data, error: dbError } = await supabase
    .from("stage_audios")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (dbError) {
    throw new Error(`Failed to update stage audio: ${dbError.message}`);
  }

  return data as IStageAudio;
}

/**
 * Permanently removes a stage audio asset from 'stage-audios' storage
 * and deletes the record from 'stage_audios' table.
 */
export async function deleteStageAudio(
  id: string,
  storagePath?: string
): Promise<void> {
  if (storagePath) {
    try {
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKETS.STAGE_AUDIOS)
        .remove([storagePath]);

      if (storageError) {
        console.warn("[stageAudioService] Storage delete error:", storageError);
      }
    } catch (err) {
      console.warn("[stageAudioService] Failed to remove storage file:", err);
    }
  }

  const { error: dbError } = await supabase
    .from("stage_audios")
    .delete()
    .eq("id", id);

  if (dbError) {
    throw new Error(`Failed to delete stage audio record: ${dbError.message}`);
  }
}
