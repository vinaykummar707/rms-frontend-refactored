import { supabase } from "@/integrations/supabase/client";
import { STORAGE_BUCKETS } from "@/integrations/supabase/storage";
import {
  synthesizeEdgeTts,
  type SynthesizeOptions,
  resolveVoice,
} from "@/features/stops/services/edgeTtsService";
import type {
  IPremadeAudio,
  IPremadeAudioCreate,
  IPremadeAudioUpdate,
} from "@/shared/types/premadeAudio";

/**
 * Creates a URL/filesystem safe slug for storage filenames
 */
export function slugifyText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/**
 * Checks if a premade audio record with the same reference_text already exists.
 * In edit mode, excludeId skips the current record.
 */
export async function checkPremadeAudioDuplicate(
  referenceText: string,
  excludeId?: string
): Promise<boolean> {
  const trimmed = referenceText.trim().toLowerCase();
  if (!trimmed) return false;

  let query = supabase
    .from("premade_audios")
    .select("id, reference_text");

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[premadeAudioService] Duplicate check error:", error);
    return false;
  }

  return (data || []).some(
    (a: any) => a.reference_text?.trim().toLowerCase() === trimmed
  );
}

/**
 * Uploads an audio file (.mp3 or .wav) to Supabase Storage in the 'audios' bucket
 * and records its metadata in the 'premade_audios' table.
 * Uses reference_text for identification and the storage filename.
 */
export async function uploadPremadeAudioFile(
  file: File,
  referenceText: string,
  metadata: {
    announcementText?: string;
    language?: string;
    voice?: string;
    speed?: string;
    createdBy?: string;
  } = {}
): Promise<IPremadeAudio> {
  const trimmedRefText = referenceText.trim();
  if (!trimmedRefText) {
    throw new Error("Reference text is required for premade audio.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const slug = slugifyText(trimmedRefText) || "audio";
  const targetFileName = `${slug}.${ext}`;
  const uniqueStorageName = `${Date.now()}-${slug}.${ext}`;
  const storagePath = `premade/${uniqueStorageName}`;

  // 1. Upload file into Supabase Storage 'audios' bucket
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.AUDIOS)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || (ext === "wav" ? "audio/wav" : "audio/mpeg"),
    });

  if (uploadError) {
    console.error("[premadeAudioService] Storage upload failed:", uploadError);
    throw new Error(`Failed to upload audio to storage: ${uploadError.message}`);
  }

  // 2. Obtain Public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKETS.AUDIOS)
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // 3. Insert record into 'premade_audios' table
  const payload: IPremadeAudioCreate = {
    reference_text: trimmedRefText,
    announcement_text: metadata.announcementText?.trim() || null,
    file_name: targetFileName,
    file_size: file.size,
    file_format: file.type || (ext === "wav" ? "audio/wav" : "audio/mpeg"),
    url: publicUrl,
    storage_path: storagePath,
    language: metadata.language || "en-IN",
    voice: metadata.voice || "en-IN-NeerjaNeural",
    speed: metadata.speed || "-4%",
    created_by: metadata.createdBy || null,
  };

  const { data, error: dbError } = await supabase
    .from("premade_audios")
    .insert(payload)
    .select()
    .single();

  if (dbError) {
    console.error("[premadeAudioService] Database insert failed:", dbError);
    // Cleanup orphaned storage file
    try {
      await supabase.storage.from(STORAGE_BUCKETS.AUDIOS).remove([storagePath]);
    } catch (cleanupErr) {
      console.warn("[premadeAudioService] Cleanup error:", cleanupErr);
    }
    throw new Error(`Failed to save premade audio record: ${dbError.message}`);
  }

  return data as IPremadeAudio;
}

/**
 * Synthesizes audio using Microsoft Edge-TTS from announcementText,
 * and names the resulting File using the Reference Title / Name text value as prefix.
 * Announcement text is strictly spoken and never used as the file prefix.
 */
export async function generatePremadeAudioFile(
  announcementText: string,
  referenceText: string,
  options: SynthesizeOptions = {}
): Promise<File> {
  const trimmedAnnouncement = announcementText.trim();
  const trimmedReference = referenceText.trim();

  if (!trimmedAnnouncement) {
    throw new Error("Announcement speech text cannot be empty.");
  }
  if (!trimmedReference) {
    throw new Error("Reference text is required.");
  }

  // Synthesize speech directly using the spoken announcement text
  const { blob } = await synthesizeEdgeTts(trimmedAnnouncement, options);

  // Strictly use Reference Title / Name text value as file prefix (never announcement text)
  const slug = slugifyText(trimmedReference) || "premade-audio";
  const fileName = `${slug}-${Date.now()}.mp3`;

  return new File([blob], fileName, { type: "audio/mpeg" });
}

/**
 * Synthesizes speech using Microsoft Edge-TTS from announcementText,
 * names the resulting audio file with referenceText slug as prefix, and stores in Supabase.
 */
export async function generateAndUploadPremadeAudio(
  announcementText: string,
  referenceText: string,
  options: SynthesizeOptions = {},
  createdBy?: string
): Promise<IPremadeAudio> {
  const trimmedAnnouncement = announcementText.trim();
  const trimmedReference = referenceText.trim();

  if (!trimmedAnnouncement) {
    throw new Error("Announcement speech text cannot be empty.");
  }
  if (!trimmedReference) {
    throw new Error("Reference text is required.");
  }

  // Generate audio file via Edge-TTS using referenceText as file prefix
  const namedFile = await generatePremadeAudioFile(
    trimmedAnnouncement,
    trimmedReference,
    options
  );

  // Resolve voice name
  const voiceName =
    options.voice || resolveVoice(options.language, options.gender);

  return await uploadPremadeAudioFile(namedFile, trimmedReference, {
    announcementText: trimmedAnnouncement,
    language: options.language || "en-IN",
    voice: voiceName,
    speed: options.rate || "-4%",
    createdBy,
  });
}

/**
 * Updates an existing premade audio record. If a new audio file is provided,
 * deletes the old storage asset and uploads the new file.
 */
export async function updatePremadeAudio(
  id: string,
  updates: {
    referenceText: string;
    announcementText?: string;
    file?: File | null;
    language?: string;
    voice?: string;
    speed?: string;
  },
  existingAudio?: IPremadeAudio
): Promise<IPremadeAudio> {
  const trimmedRefText = updates.referenceText.trim();
  if (!trimmedRefText) {
    throw new Error("Reference text is required.");
  }

  const payload: IPremadeAudioUpdate = {
    id,
    reference_text: trimmedRefText,
    announcement_text: updates.announcementText?.trim() || null,
    language: updates.language,
    voice: updates.voice,
    speed: updates.speed,
  };

  // If new file provided, upload replacement and cleanup old storage file
  if (updates.file) {
    const ext = updates.file.name.split(".").pop()?.toLowerCase() || "mp3";
    const slug = slugifyText(trimmedRefText) || "audio";
    const targetFileName = `${slug}.${ext}`;
    const uniqueStorageName = `${Date.now()}-${slug}.${ext}`;
    const storagePath = `premade/${uniqueStorageName}`;

    // Upload new file
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.AUDIOS)
      .upload(storagePath, updates.file, {
        cacheControl: "3600",
        upsert: true,
        contentType: updates.file.type || (ext === "wav" ? "audio/wav" : "audio/mpeg"),
      });

    if (uploadError) {
      throw new Error(`Failed to upload replacement audio: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKETS.AUDIOS)
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
          .from(STORAGE_BUCKETS.AUDIOS)
          .remove([existingAudio.storage_path]);
      } catch (delErr) {
        console.warn("[premadeAudioService] Could not remove old file:", delErr);
      }
    }
  }

  const { data, error: updateError } = await supabase
    .from("premade_audios")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update premade audio: ${updateError.message}`);
  }

  return data as IPremadeAudio;
}

/**
 * Deletes both the Supabase Storage file and the database record
 */
export async function deletePremadeAudio(audio: IPremadeAudio): Promise<void> {
  // 1. Remove from storage bucket
  if (audio.storage_path) {
    try {
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKETS.AUDIOS)
        .remove([audio.storage_path]);
      if (storageError) {
        console.warn("[premadeAudioService] Storage delete warning:", storageError.message);
      }
    } catch (err) {
      console.warn("[premadeAudioService] Storage removal exception:", err);
    }
  }

  // 2. Remove from database table
  const { error: dbError } = await supabase
    .from("premade_audios")
    .delete()
    .match({ id: audio.id });

  if (dbError) {
    console.error("[premadeAudioService] Database delete failed:", dbError);
    throw new Error(`Failed to delete premade audio record: ${dbError.message}`);
  }
}
