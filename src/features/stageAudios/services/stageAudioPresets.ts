import type { StageType } from "@/shared/types/stageAudio";

export interface IStagePresetRecord {
  current_stop: string;
  next_stop: string;
  arriving_stop: string;
}

/**
 * Natural, native public transit announcement phrase presets for each supported Indian language.
 */
export const STAGE_PRESETS: Record<string, IStagePresetRecord> = {
  "en-IN": {
    current_stop: "Current stop is",
    next_stop: "Next stop is",
    arriving_stop: "Arriving at",
  },
  "hi-IN": {
    current_stop: "वर्तमान स्टॉप है",
    next_stop: "अगला स्टॉप है",
    arriving_stop: "आने वाला स्टॉप है",
  },
  "kn-IN": {
    current_stop: "ಪ್ರಸ್ತುತ ನಿಲ್ದಾಣ",
    next_stop: "ಮುಂದಿನ ನಿಲ್ದಾಣ",
    arriving_stop: "ತಲುಪುತ್ತಿರುವ ನಿಲ್ದಾಣ",
  },
  "te-IN": {
    current_stop: "ప్రస్తుత స్టాప్",
    next_stop: "తదుపరి స్టాప్",
    arriving_stop: "చేరుకుంటున్న స్టాప్",
  },
  "ta-IN": {
    current_stop: "தற்போதைய நிறுத்தம்",
    next_stop: "அடுத்த நிறுத்தம்",
    arriving_stop: "வந்து சேரும் நிறுத்தம்",
  },
  "ml-IN": {
    current_stop: "നിലവിലെ സ്റ്റോപ്പ്",
    next_stop: "അടുത്ത സ്റ്റോപ്പ്",
    arriving_stop: "എത്തിച്ചേരുന്ന സ്റ്റോപ്പ്",
  },
  "mr-IN": {
    current_stop: "सध्याचा थांबा",
    next_stop: "पुढील थांबा",
    arriving_stop: "येणारा थांबा",
  },
  "gu-IN": {
    current_stop: "હાલનો સ્ટોપ",
    next_stop: "આગળનો સ્ટોપ",
    arriving_stop: "આવનાર સ્ટોપ",
  },
  "bn-IN": {
    current_stop: "বর্তমান স্টপ",
    next_stop: "পরবর্তী স্টপ",
    arriving_stop: "আসন্ন স্টপ",
  },
  "pa-IN": {
    current_stop: "ਮੌਜੂਦਾ ਸਟਾਪ",
    next_stop: "ਅਗਲਾ ਸਟਾਪ",
    arriving_stop: "ਆਉਣ ਵਾਲਾ ਸਟਾਪ",
  },
  "or-IN": {
    current_stop: "ବର୍ତ୍ତମାନର ଷ୍ଟପ୍",
    next_stop: "ପରବର୍ତ୍ତୀ ଷ୍ଟପ୍",
    arriving_stop: "ଆସୁଥିବା ଷ୍ଟପ୍",
  },
};

/**
 * Returns the recommended native speech preset for a language and stage type.
 */
export function getStagePreset(language: string, stageType: StageType): string {
  const langKey = language.toLowerCase();
  const found = Object.keys(STAGE_PRESETS).find(
    (k) => k.toLowerCase() === langKey
  );
  if (found && STAGE_PRESETS[found]?.[stageType]) {
    return STAGE_PRESETS[found][stageType];
  }
  return STAGE_PRESETS["en-IN"]?.[stageType] || "";
}

/**
 * Returns default human-readable reference label for a stage type and language
 */
export function getDefaultReferenceText(
  languageName: string,
  stageType: StageType
): string {
  const stageName =
    stageType === "current_stop"
      ? "Current Stop"
      : stageType === "next_stop"
      ? "Next Stop"
      : "Arriving Stop";
  return `${languageName} - ${stageName}`;
}

