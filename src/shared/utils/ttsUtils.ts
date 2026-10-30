import { supabase } from "@/integrations/supabase/client";
import { env } from "@/config/env";
import { uploadStopAudioFile } from "@/integrations/supabase/storage";

export function normalizeSarvamLanguageCode(lang?: string): string {
  if (!lang) return "en-IN";
  const l = lang.toLowerCase().trim();
  if (l === "en" || l === "english" || l === "en-in") return "en-IN";
  if (l === "hi" || l === "hindi" || l === "hi-in") return "hi-IN";
  if (l === "te" || l === "telugu" || l === "te-in") return "te-IN";
  if (l === "ta" || l === "tamil" || l === "ta-in") return "ta-IN";
  if (l === "kn" || l === "kannada" || l === "kn-in") return "kn-IN";
  if (l === "ml" || l === "malayalam" || l === "ml-in") return "ml-IN";
  if (l === "mr" || l === "marathi" || l === "mr-in") return "mr-IN";
  if (l === "gu" || l === "gujarati" || l === "gu-in") return "gu-IN";
  if (l === "bn" || l === "bengali" || l === "bn-in") return "bn-IN";
  if (l === "pa" || l === "punjabi" || l === "pa-in") return "pa-IN";
  if (l === "or" || l === "odia" || l === "or-in") return "or-IN";
  return lang.includes("-") ? lang : `${lang}-IN`;
}

export const TTS_VOICES = [
  { id: "meera", name: "Meera (Female)", gender: "female" },
  { id: "arvind", name: "Arvind (Male)", gender: "male" },
] as const;

/**
 * Converts stop names into Title Case for natural pronunciation
 */
export function normalizeStopNameForSpeech(text: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  return trimmed.toLowerCase().replace(/(?:^|\s|-|\/)\S/g, (c) => c.toUpperCase());
}

/**
 * Generates a valid 16-bit PCM mono WAV Blob (audio chime)
 * Fallback when VITE_SARVAM_API_KEY is not configured.
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

export function base64ToBlob(base64: string, mimeType: string = "audio/wav"): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function fetchTTS(
  text: string,
  lang: string = "en-IN",
  speaker: string = "meera"
): Promise<string> {
  const normalizedText = normalizeStopNameForSpeech(text);
  const normalizedLang = normalizeSarvamLanguageCode(lang);
  const normalizedSpeaker = speaker || "meera";

  const sarvamKey = env.VITE_SARVAM_API_KEY;
  if (!sarvamKey) {
    console.warn(
      `[TTS] VITE_SARVAM_API_KEY is not configured. Generating synthetic audio announcement for "${normalizedText}".`
    );
    const mockBlob = createSyntheticWavBlob(0.8, 520);
    return blobToBase64(mockBlob);
  }

  try {
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": sarvamKey,
      },
      body: JSON.stringify({
        inputs: [normalizedText],
        text: normalizedText,
        model: "bulbul:v2",
        speaker: normalizedSpeaker,
        target_language_code: normalizedLang,
        pace: 0.85,
        speech_sample_rate: 22050,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMsg =
        errorData?.message ||
        errorData?.detail ||
        `Sarvam TTS API returned status ${response.status}`;
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const audioData = data.audios?.[0] || data.audio;
    if (!audioData) {
      throw new Error("No audio returned from TTS service");
    }
    return audioData;
  } catch (error: any) {
    console.error("fetchTTS Error:", error);
    console.warn("[TTS] Falling back to synthetic audio chime.");
    const mockBlob = createSyntheticWavBlob(0.8, 440);
    return blobToBase64(mockBlob);
  }
}

export async function generateAudio(
  text: string,
  lang: string = "en-IN",
  speaker: string = "meera"
): Promise<File> {
  const base64Audio = await fetchTTS(text, lang, speaker);
  const audioBlob = base64ToBlob(base64Audio, "audio/wav");
  const fileName = `tts-${Date.now()}.wav`;
  return new File([audioBlob], fileName, { type: "audio/wav" });
}

export async function handleStopAudioGeneration(
  stopName: string,
  stopId: string,
  lang: string = "en-IN",
  speaker: string = "meera"
): Promise<{ fileUrl: string; size: number; fileName: string }> {
  try {
    const audioFile = await generateAudio(stopName, lang, speaker);
    const { fileUrl, size } = await uploadStopAudioFile(audioFile, stopId);

    const { error: dbError } = await supabase.from("stop_audios").insert([
      {
        stop_id: stopId,
        url: fileUrl,
        file_name: audioFile.name,
        file_size: size,
      },
    ]);

    if (dbError) {
      throw new Error(`Error inserting audio record: ${dbError.message}`);
    }

    return { fileUrl, size, fileName: audioFile.name };
  } catch (error) {
    console.error("Failed to generate and upload stop audio:", error);
    throw error;
  }
}

export async function handleSloganAudioGeneration(
  stopName: string,
  stopId: string,
  lang: string = "en-IN",
  speaker: string = "meera"
): Promise<{ fileUrl: string; size: number; fileName: string }> {
  try {
    const audioFile = await generateAudio(stopName, lang, speaker);
    const { fileUrl, size } = await uploadStopAudioFile(audioFile, stopId);
    return { fileUrl, size, fileName: audioFile.name };
  } catch (error) {
    console.error("Failed to generate and upload slogan audio:", error);
    throw error;
  }
}

