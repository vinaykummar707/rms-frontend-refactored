import { fetchTransliteration } from "@/shared/utils/transliteration";
import { getStagePreset } from "@/features/stageAudios/services/stageAudioPresets";

export interface RouteSimStopOption {
  id: string;
  name: string;
  name_kn?: string;
  isCustom?: boolean;
  stopAudioUrl?: string | null;
  stop_audios?: any;
  [key: string]: any;
}

export type SimStageType = "current" | "next" | "arriving";

/** In-memory cache for transliterated stop names across language selections */
export const transliterationCache = new Map<string, string>();

/**
 * Normalizes language codes to base prefix (e.g. 'kn-IN' -> 'kn', 'hi-IN' -> 'hi')
 */
export function getBaseLanguageCode(langCode: string): string {
  return (langCode || "")
    .toLowerCase()
    .trim()
    .split("-")[0]
    .split("_")[0]
    .replace(/\d+$/, "");
}

/**
 * Transliterates a given stop name to the destination language script.
 * Caches phonetic suggestions to provide instant repeat lookups.
 */
export async function transliterateStopText(
  text: string,
  langCode: string
): Promise<string> {
  const cleanText = (text || "").trim();
  if (!cleanText) return "";

  const baseLang = getBaseLanguageCode(langCode);
  if (baseLang === "en" || !baseLang) {
    return cleanText;
  }

  const cacheKey = `${baseLang}:${cleanText.toLowerCase()}`;
  if (transliterationCache.has(cacheKey)) {
    return transliterationCache.get(cacheKey) || cleanText;
  }

  try {
    const suggestions = await fetchTransliteration(cleanText, baseLang);
    if (suggestions && suggestions.length > 0 && suggestions[0]) {
      const bestMatch = suggestions[0];
      transliterationCache.set(cacheKey, bestMatch);
      return bestMatch;
    }
  } catch (error) {
    console.warn(`Transliteration failed for "${cleanText}" to "${baseLang}":`, error);
  }

  // Gracefully fallback to clean English text if transliteration fails
  transliterationCache.set(cacheKey, cleanText);
  return cleanText;
}

/**
 * Computes immediate synchronous announcement text.
 * Uses DB regional name (name_kn) for Kannada, cached transliteration if available,
 * or localized stage prefix + stop name.
 */
export function computeSyncAnnouncementText(
  stop: RouteSimStopOption,
  stage: SimStageType,
  lang: string
): string {
  const baseLang = getBaseLanguageCode(lang);

  if (baseLang === "en" || !baseLang) {
    const prefix =
      stage === "current"
        ? "CURRENT STOP IS"
        : stage === "next"
        ? "NEXT STOP IS"
        : "ARRIVING AT";
    return `${prefix} ${(stop.name || "").toUpperCase()}`;
  }

  const stagePresetKey =
    stage === "current"
      ? "current_stop"
      : stage === "next"
      ? "next_stop"
      : "arriving_stop";
  const stagePreset = getStagePreset(lang, stagePresetKey);

  if (baseLang === "kn" && stop.name_kn && stop.name_kn.trim()) {
    return `${stagePreset} ${stop.name_kn.trim()}`;
  }

  const cacheKey = `${baseLang}:${(stop.name || "").trim().toLowerCase()}`;
  const cached = transliterationCache.get(cacheKey);
  const displayName = cached || stop.name || "";

  return `${stagePreset} ${displayName}`;
}

/**
 * Asynchronously resolves the full announcement phrase translated/transliterated into the target language.
 */
export async function getTransliteratedAnnouncementText(
  stop: RouteSimStopOption,
  stage: SimStageType,
  lang: string
): Promise<string> {
  const baseLang = getBaseLanguageCode(lang);

  if (baseLang === "en" || !baseLang) {
    return computeSyncAnnouncementText(stop, stage, lang);
  }

  const stagePresetKey =
    stage === "current"
      ? "current_stop"
      : stage === "next"
      ? "next_stop"
      : "arriving_stop";
  const stagePreset = getStagePreset(lang, stagePresetKey);

  if (baseLang === "kn" && stop.name_kn && stop.name_kn.trim()) {
    return `${stagePreset} ${stop.name_kn.trim()}`;
  }

  const transliterated = await transliterateStopText(stop.name || "", lang);
  return `${stagePreset} ${transliterated || stop.name || ""}`;
}

