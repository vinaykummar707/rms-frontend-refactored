export interface ITtsVoice {
  id: string;
  name: string;
  gender: "female" | "male";
  locale: string;
  languageName: string;
  nativeName?: string;
  isDefault?: boolean;
}

export interface ILanguageOption {
  code: string;
  name: string;
  nativeName: string;
  defaultVoice: string;
  voices: {
    female: string;
    male: string;
    expressive?: string;
  };
}

export const INDIAN_LANGUAGES: ILanguageOption[] = [
  {
    code: "en-IN",
    name: "English (India)",
    nativeName: "English (India)",
    defaultVoice: "en-IN-NeerjaNeural",
    voices: {
      female: "en-IN-NeerjaNeural",
      male: "en-IN-PrabhatNeural",
      expressive: "en-IN-NeerjaExpressiveNeural",
    },
  },
  {
    code: "hi-IN",
    name: "Hindi",
    nativeName: "हिन्दी",
    defaultVoice: "hi-IN-SwaraNeural",
    voices: {
      female: "hi-IN-SwaraNeural",
      male: "hi-IN-MadhurNeural",
    },
  },
  {
    code: "kn-IN",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    defaultVoice: "kn-IN-SapnaNeural",
    voices: {
      female: "kn-IN-SapnaNeural",
      male: "kn-IN-GaganNeural",
    },
  },
  {
    code: "te-IN",
    name: "Telugu",
    nativeName: "తెలుగు",
    defaultVoice: "te-IN-ShrutiNeural",
    voices: {
      female: "te-IN-ShrutiNeural",
      male: "te-IN-MohanNeural",
    },
  },
  {
    code: "ta-IN",
    name: "Tamil",
    nativeName: "தமிழ்",
    defaultVoice: "ta-IN-PallaviNeural",
    voices: {
      female: "ta-IN-PallaviNeural",
      male: "ta-IN-ValluvarNeural",
    },
  },
  {
    code: "ml-IN",
    name: "Malayalam",
    nativeName: "മലയാളം",
    defaultVoice: "ml-IN-SobhanaNeural",
    voices: {
      female: "ml-IN-SobhanaNeural",
      male: "ml-IN-MidhunNeural",
    },
  },
  {
    code: "mr-IN",
    name: "Marathi",
    nativeName: "मराठी",
    defaultVoice: "mr-IN-AarohiNeural",
    voices: {
      female: "mr-IN-AarohiNeural",
      male: "mr-IN-ManoharNeural",
    },
  },
  {
    code: "gu-IN",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    defaultVoice: "gu-IN-DhwaniNeural",
    voices: {
      female: "gu-IN-DhwaniNeural",
      male: "gu-IN-NiranjanNeural",
    },
  },
  {
    code: "bn-IN",
    name: "Bengali",
    nativeName: "বাংলা",
    defaultVoice: "bn-IN-TanishaaNeural",
    voices: {
      female: "bn-IN-TanishaaNeural",
      male: "bn-IN-BashkarNeural",
    },
  },
  {
    code: "ur-IN",
    name: "Urdu",
    nativeName: "اردو",
    defaultVoice: "ur-IN-GulNeural",
    voices: {
      female: "ur-IN-GulNeural",
      male: "ur-IN-SalmanNeural",
    },
  },
];

export const DEFAULT_LANGUAGE = "en-IN";
export const DEFAULT_VOICE = "en-IN-NeerjaNeural";
export const DEFAULT_RATE = "-4%"; // Slightly deliberate pacing ideal for noisy transit public address speakers

export function resolveVoice(langCode?: string, gender: "female" | "male" = "female"): string {
  if (!langCode) return gender === "male" ? "en-IN-PrabhatNeural" : "en-IN-NeerjaNeural";
  
  const normalized = langCode.toLowerCase().trim();
  const lang = INDIAN_LANGUAGES.find(
    (l) => l.code.toLowerCase() === normalized || l.code.split("-")[0].toLowerCase() === normalized
  );

  if (!lang) return gender === "male" ? "en-IN-PrabhatNeural" : "en-IN-NeerjaNeural";
  return gender === "male" ? lang.voices.male : lang.voices.female;
}

