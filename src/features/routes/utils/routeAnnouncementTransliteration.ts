import { fetchTransliteration } from "@/shared/utils/transliteration";
import { getStagePreset } from "@/features/stageAudios/services/stageAudioPresets";
import { fetchBitmapMatrix } from "@/features/bitmap/services/bitmapService";
import { AVAILABLE_LANGUAGES } from "@/config/constants/languages";
import type {
  IRouteStopRecord,
  IRouteStopLanguageRecord,
  IRouteStageAudioRecord,
  IRouteStageAudioLanguageRecord,
} from "@/shared/types/routeConfigV2";
import type { IStageAudio, StageType } from "@/shared/types/stageAudio";

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

/** In-memory cache for generated LED bitmaps */
export const bitmapCache = new Map<string, string>();

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

/**
 * Generates structured IRouteStopRecord[] for all stops in a route across each chosen language.
 * Contains only: stopId, stopName, audioFileUrl, audioFileName, latitude, longitude,
 * and for each chosen language: language, translitaratedtext, bitmap.
 */
export async function generateRouteStopRecords({
  stops,
  languages,
  depotStops = [],
  getFontFamily,
  fontHeight = 16,
}: {
  stops: RouteSimStopOption[];
  languages: string[];
  depotStops?: any[];
  getFontFamily?: (lang: string, key: string, height?: number) => string;
  fontHeight?: number;
}): Promise<IRouteStopRecord[]> {
  const targetLanguages = Array.from(new Set(languages.filter(Boolean)));
  if (targetLanguages.length === 0) {
    targetLanguages.push("en");
  }

  const results: IRouteStopRecord[] = [];

  for (let idx = 0; idx < stops.length; idx++) {
    const stop = stops[idx];
    const cleanName = (stop.name || "").trim();
    if (!cleanName) continue;

    const matched = depotStops.find(
      (s) =>
        s.id === stop.id ||
        (s.name && s.name.toLowerCase().trim() === cleanName.toLowerCase())
    );

    const stopId = matched?.id || stop.id || `stop-${idx + 1}`;
    const stopName = matched?.name || cleanName;

    const audioRec = Array.isArray(matched?.stop_audios)
      ? matched?.stop_audios[0]
      : matched?.stop_audios;
    const audioFileUrl = audioRec?.url || stop.stopAudioUrl || null;
    const audioFileName = audioRec?.file_name || null;

    const rawLat = matched?.latitude ?? matched?.up_latitude ?? matched?.down_latitude ?? stop.latitude ?? null;
    const rawLng = matched?.longitude ?? matched?.up_longitude ?? matched?.down_longitude ?? stop.longitude ?? null;
    const latNum = typeof rawLat === "number" ? rawLat : rawLat ? parseFloat(rawLat) : null;
    const lngNum = typeof rawLng === "number" ? rawLng : rawLng ? parseFloat(rawLng) : null;

    const languageRecords: IRouteStopLanguageRecord[] = [];

    for (const lang of targetLanguages) {
      const baseLang = getBaseLanguageCode(lang);
      let transliteratedText = stopName;

      if (baseLang === "en") {
        transliteratedText = stopName;
      } else if (baseLang === "kn" && (matched?.name_kn || stop.name_kn)) {
        transliteratedText = (matched?.name_kn || stop.name_kn || "").trim();
      } else {
        transliteratedText = await transliterateStopText(stopName, lang);
      }

      // Generate or retrieve cached LED bitmap
      let bitmapStr = "";
      try {
        const fontFamily = getFontFamily ? getFontFamily(lang, "text", fontHeight) : undefined;
        const bitmapKey = `${baseLang}:${fontHeight}:${fontFamily || "default"}:${transliteratedText}`;

        if (bitmapCache.has(bitmapKey)) {
          bitmapStr = bitmapCache.get(bitmapKey) || "";
        } else {
          bitmapStr = await fetchBitmapMatrix({
            text: transliteratedText,
            height: fontHeight,
            weight: "Bold",
            family: fontFamily,
          });
          if (bitmapStr) {
            bitmapCache.set(bitmapKey, bitmapStr);
          }
        }
      } catch (bitmapError) {
        console.warn(`Bitmap generation skipped for "${transliteratedText}" (${lang}):`, bitmapError);
        bitmapStr = "";
      }

      languageRecords.push({
        language: lang,
        translitaratedtext: transliteratedText,
        bitmap: bitmapStr || "",
      });
    }

    results.push({
      stopId,
      stopName,
      audioFileUrl,
      audioFileName,
      latitude: Number.isFinite(latNum) ? latNum : null,
      longitude: Number.isFinite(lngNum) ? lngNum : null,
      languages: languageRecords,
    });
  }

  return results;
}

/**
 * Generates structured IRouteStageAudioRecord[] for all announcement stages ('current', 'next', 'arriving')
 * across all chosen route languages.
 * Resolves localized text, audio URLs (DB stage_audios or static fallback presets), and 16-height LED bitmaps.
 */
export async function generateRouteStageAudioRecords({
  languages,
  stageAudios = [],
  getFontFamily,
  fontHeight = 16,
}: {
  languages: string[];
  stageAudios?: IStageAudio[];
  getFontFamily?: (lang: string, key: string, height?: number) => string;
  fontHeight?: number;
}): Promise<IRouteStageAudioRecord[]> {
  const STAGES: Array<{ id: "current" | "next" | "arriving"; dbType: StageType; label: string }> = [
    { id: "current", dbType: "current_stop", label: "Current Stop" },
    { id: "next", dbType: "next_stop", label: "Next Stop" },
    { id: "arriving", dbType: "arriving_stop", label: "Arriving Stop" },
  ];

  const targetLanguages = Array.from(new Set(languages.filter(Boolean)));
  if (targetLanguages.length === 0) {
    targetLanguages.push("en");
  }

  const results: IRouteStageAudioRecord[] = [];

  for (const stg of STAGES) {
    const langRecords: IRouteStageAudioLanguageRecord[] = [];

    for (const lang of targetLanguages) {
      const baseLang = getBaseLanguageCode(lang);

      // 1. Resolve Audio URL & File Name
      const dbMatch = stageAudios.find((a) => {
        if (a.stage_type !== stg.dbType) return false;
        const aLang = (a.language || "").toLowerCase();
        const baseLower = baseLang.toLowerCase();
        const langLower = lang.toLowerCase();
        return (
          aLang === langLower ||
          aLang === baseLower ||
          aLang.startsWith(baseLower + "-") ||
          baseLower.startsWith(aLang)
        );
      });

      const staticPreset = AVAILABLE_LANGUAGES.find(
        (l) => l.code.toLowerCase() === baseLang
      );

      let audioFileUrl: string | null = null;
      let audioFileName: string | null = null;

      if (dbMatch?.url) {
        audioFileUrl = dbMatch.url;
        audioFileName = dbMatch.file_name || null;
      } else if (staticPreset) {
        if (stg.id === "current") {
          audioFileUrl = staticPreset.current || null;
          audioFileName = staticPreset.currentFileName || null;
        } else if (stg.id === "next") {
          audioFileUrl = staticPreset.next || null;
          audioFileName = staticPreset.nextFileName || null;
        } else {
          audioFileUrl = staticPreset.coming || null;
          audioFileName = staticPreset.comingFileName || null;
        }
      }

      // 2. Resolve Localized Phrase Text
      let text = dbMatch?.announcement_text?.trim() || "";
      if (!text) {
        text = getStagePreset(lang, stg.dbType);
      }

      // 3. Generate LED Bitmap (height: fontHeight)
      let bitmapStr = "";
      if (text) {
        try {
          const fontFamily = getFontFamily ? getFontFamily(lang, "text", fontHeight) : undefined;
          const bitmapKey = `${baseLang}:${fontHeight}:${fontFamily || "default"}:${text}`;

          if (bitmapCache.has(bitmapKey)) {
            bitmapStr = bitmapCache.get(bitmapKey) || "";
          } else {
            bitmapStr = await fetchBitmapMatrix({
              text,
              height: fontHeight,
              weight: "Bold",
              family: fontFamily,
            });
            if (bitmapStr) {
              bitmapCache.set(bitmapKey, bitmapStr);
            }
          }
        } catch (bitmapError) {
          console.warn(`Stage bitmap generation skipped for "${text}" (${lang}):`, bitmapError);
          bitmapStr = "";
        }
      }

      langRecords.push({
        language: lang,
        text,
        audioFileUrl,
        audioFileName,
        bitmap: bitmapStr || "",
      });
    }

    results.push({
      stage: stg.id,
      stageLabel: stg.label,
      languages: langRecords,
    });
  }

  return results;
}

