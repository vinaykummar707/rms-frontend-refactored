import { useLanguageConfigs } from "../context/LanguageConfigContext";

const SCRIPT_FALLBACKS: Record<string, string> = {
  hi: "Noto Sans Devanagari",
  mr: "Noto Sans Devanagari",
  kn: "Noto Sans Kannada",
  te: "Noto Sans Telugu",
  ta: "Noto Sans Tamil",
  ml: "Noto Sans Malayalam",
  bn: "Noto Sans Bengali",
  gu: "Noto Sans Gujarati",
  pa: "Noto Sans Gurmukhi",
  en: "Arial",
};

export type FontConfigSection = {
  fontHeight?: string | number | null;
  fontFamily8?: string;
  fontFamily16?: string;
  fontFamily32?: string;
};

export const parseConfiguredFontHeights = (
  rawHeights?: string | number | null
): number[] => {
  if (rawHeights === undefined || rawHeights === null) {
    return [];
  }

  const values = String(rawHeights)
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  return Array.from(new Set(values)).sort((a, b) => a - b);
};

export const getFontFamilyByHeight = (
  fontHeight: number,
  configForSection: FontConfigSection,
  fallbackFont: string
): string => {
  const use8 = fontHeight <= 8;
  const use16 = fontHeight > 8 && fontHeight <= 16;

  const fontFamily = use8
    ? configForSection.fontFamily8 || fallbackFont
    : use16
    ? configForSection.fontFamily16 || fallbackFont
    : configForSection.fontFamily32 || configForSection.fontFamily16 || fallbackFont;

  return fontFamily && fontFamily !== "Arial" ? fontFamily : fallbackFont;
};

export const normalizeLang = (l?: string): string => {
  if (!l) return "en";
  const lower = l.toLowerCase().trim();
  const base = lower.replace(/\d+$/, "");
  if (base === "english" || base === "en") return "en";
  if (base === "hindi" || base === "hi") return "hi";
  if (base === "telugu" || base === "te") return "te";
  if (base === "kannada" || base === "kn") return "kn";
  if (base === "tamil" || base === "ta") return "ta";
  if (base === "marathi" || base === "mr") return "mr";
  if (base === "malayalam" || base === "ml") return "ml";
  if (base === "bengali" || base === "bn") return "bn";
  if (base === "gujarati" || base === "gu") return "gu";
  return base;
};

export function useFontFileByLanguage() {
  const offsetConfigs = useLanguageConfigs();

  return (lang: string, key: string, fontHeight?: number): string => {
    const targetLang = normalizeLang(lang);
    const fallbackFont = SCRIPT_FALLBACKS[targetLang] || "Arial";

    const langObj = offsetConfigs?.configs?.find(
      (language) =>
        normalizeLang(language.code) === targetLang ||
        language.name?.toLowerCase() === targetLang
    );
    if (!langObj || !langObj.config) return fallbackFont;

    const config = langObj.config as unknown as Record<string, FontConfigSection | undefined>;
    const configForSection = config[key] || config["text"] || config["sideText"];
    if (!configForSection) return fallbackFont;

    const configuredHeights = parseConfiguredFontHeights(configForSection.fontHeight);

    if (typeof fontHeight === "number" && Number.isFinite(fontHeight)) {
      const normalizedHeight = Math.round(fontHeight);
      if (configuredHeights.includes(normalizedHeight)) {
        return getFontFamilyByHeight(normalizedHeight, configForSection, fallbackFont);
      }

      return getFontFamilyByHeight(fontHeight, configForSection, fallbackFont);
    }

    return getFontFamilyByHeight(16, configForSection, fallbackFont);
  };
}

export function useFontHeightsForLanguage() {
  const offsetConfigs = useLanguageConfigs();

  return (lang: string, key: string): number[] => {
    const targetLang = normalizeLang(lang);
    const langObj = offsetConfigs.configs.find(
      (language) =>
        normalizeLang(language.code) === targetLang ||
        language.name?.toLowerCase() === targetLang
    );
    if (!langObj || !langObj.config) return [];

    const config = langObj.config as unknown as Record<string, FontConfigSection | undefined>;
    const configForSection = config[key] || config["text"] || config["sideText"];
    if (!configForSection) return [];

    return parseConfiguredFontHeights(configForSection.fontHeight);
  };
}

export function useFontHeightForLanguage() {
  const getConfiguredHeights = useFontHeightsForLanguage();

  return (lang: string, key: string): number => {
    const configuredHeights = getConfiguredHeights(lang, key);
    return configuredHeights[0] || 16;
  };
}
