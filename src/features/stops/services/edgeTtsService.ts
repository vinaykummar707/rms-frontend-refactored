import { supabase } from "@/integrations/supabase/client";
import { uploadStopAudioFile } from "@/integrations/supabase/storage";
import {
  INDIAN_LANGUAGES,
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE,
  DEFAULT_RATE,
  resolveVoice,
  type ILanguageOption,
} from "../../../../server/voices";

export { INDIAN_LANGUAGES, DEFAULT_LANGUAGE, DEFAULT_VOICE, DEFAULT_RATE, resolveVoice };
export type { ILanguageOption };

export interface SynthesizeOptions {
  voice?: string;
  language?: string;
  gender?: "female" | "male";
  rate?: string;
  volume?: string;
  pitch?: string;
}

/**
 * Creates a fallback synthetic WAV chime for development or offline testing
 */
export function createSyntheticWavBlob(
  durationSeconds: number = 0.8,
  frequency: number = 440
): Blob {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-3 * t);
    const intSample = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    view.setInt16(44 + i * 2, intSample, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Resolves the TTS API endpoint URL:
 * - If VITE_TTS_API_URL is provided, use it.
 * - In local dev (Vite proxy active on port 9092), return relative path so Vite proxies it.
 * - In production when hosted via `serve` on another port (e.g. 5173), direct the browser to the same host on port 5050.
 */
export function getTtsApiUrl(path: string = "/api/tts/synthesize"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // 1. Explicit env variable override
  const envBase = (import.meta as any).env?.VITE_TTS_API_URL;
  if (envBase) {
    return `${envBase.replace(/\/+$/, "")}${cleanPath}`;
  }

  // 2. Vite development mode (uses proxy defined in vite.config.ts)
  if ((import.meta as any).env?.DEV) {
    return cleanPath;
  }

  // 3. Browser production runtime (e.g. hosted via `serve -s dist -l 5173`)
  if (typeof window !== "undefined" && window.location) {
    if (window.location.port && window.location.port !== "5050") {
      return `${window.location.protocol}//${window.location.hostname}:5050${cleanPath}`;
    }
  }

  return cleanPath;
}

/**
 * Synthesizes audio using Microsoft Edge TTS via the local Express relay server
 */
export async function synthesizeEdgeTts(
  text: string,
  options: SynthesizeOptions = {}
): Promise<{ blob: Blob; audioUrl: string }> {
  if (!text || !text.trim()) {
    throw new Error("Text is required for audio synthesis.");
  }

  try {
    const apiUrl = getTtsApiUrl("/api/tts/synthesize");
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice: options.voice,
        language: options.language || DEFAULT_LANGUAGE,
        gender: options.gender || "female",
        rate: options.rate || DEFAULT_RATE,
        volume: options.volume || "+0%",
        pitch: options.pitch || "+0Hz",
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      const message =
        errorJson?.error ||
        errorJson?.details ||
        `TTS server returned error status ${response.status}`;
      throw new Error(message);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("Received empty audio response from TTS server.");
    }

    const audioUrl = URL.createObjectURL(blob);
    return { blob, audioUrl };
  } catch (err: any) {
    console.error("[edgeTtsService] Synthesis error:", err);
    throw err;
  }
}

/**
 * Synthesizes speech and returns a File object suitable for uploading to Supabase
 */
export async function generateStopAudioFile(
  stopName: string,
  options: SynthesizeOptions = {}
): Promise<File> {
  const { blob } = await synthesizeEdgeTts(stopName, options);
  const cleanName = stopName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const fileName = `tts-${cleanName || "stop"}-${Date.now()}.mp3`;

  return new File([blob], fileName, { type: "audio/mpeg" });
}

/**
 * Synthesizes audio for a stop, uploads to Supabase storage 'stops' bucket,
 * and inserts a record into the 'stop_audios' database table.
 */
export async function generateAndUploadStopAudio(
  stopName: string,
  stopId: string,
  options: SynthesizeOptions = {}
): Promise<{ fileUrl: string; size: number; fileName: string }> {
  if (!stopName || !stopId) {
    throw new Error("Both stopName and stopId are required.");
  }

  const audioFile = await generateStopAudioFile(stopName, options);
  const { fileUrl, size } = await uploadStopAudioFile(audioFile, stopId);

  // Insert database record
  const { error: dbError } = await supabase.from("stop_audios").insert([
    {
      stop_id: stopId,
      url: fileUrl,
      file_name: audioFile.name,
      file_size: size,
    },
  ]);

  if (dbError) {
    throw new Error(`Failed to save stop audio record: ${dbError.message}`);
  }

  return {
    fileUrl,
    size,
    fileName: audioFile.name,
  };
}
