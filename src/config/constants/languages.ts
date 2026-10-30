export interface AvailableLanguage {
  code: string;
  label: string;
  current?: string;
  currentFileName?: string;
  next?: string;
  nextFileName?: string;
  coming?: string;
  comingFileName?: string;
  [key: string]: string | undefined;
}

export const AVAILABLE_LANGUAGES: AvailableLanguage[] = [
  {
    code: "en",
    label: "English",
    current:
      "http://31.97.228.29:8000/storage/v1/object/public/audios/static/en/current_stop_en.mp3",
    currentFileName: "current_stop_en.mp3",
    next: "http://31.97.228.29:8000/storage/v1/object/public/audios/static/en/next_stop_en.mp3",
    nextFileName: "next_stop_en.mp3",
    coming:
      "http://31.97.228.29:8000/storage/v1/object/public/audios/static/en/arriving_stop_en.mp3",
    comingFileName: "arriving_stop_en.mp3",
  },
  {
    code: "hi",
    label: "Hindi",
    current:
      "http://31.97.228.29:8000/storage/v1/object/public/audios/static/hi/cs_hi.mp3",
    currentFileName: "cs_hi.mp3",
    next: "http://31.97.228.29:8000/storage/v1/object/public/audios/static/hi/ns_hi.mp3",
    nextFileName: "ns_hi.mp3",
    coming:
      "http://31.97.228.29:8000/storage/v1/object/public/audios/static/hi/as_hi.mp3",
    comingFileName: "as_hi.mp3",
  },
  { code: "as", label: "Assamese", current: "", next: "", coming: "" },
  { code: "bn", label: "Bengali", current: "", next: "", coming: "" },
  { code: "gu", label: "Gujarati", current: "", next: "", coming: "" },
  {
    code: "kn",
    label: "Kannada",
    current:
      "http://31.97.228.29:8000/storage/v1/object/public/audios/static/kn/cs_kn.mp3",
    currentFileName: "cs_kn.mp3",
    next: "http://31.97.228.29:8000/storage/v1/object/public/audios/static/kn/ns_kn.mp3",
    nextFileName: "ns_kn.mp3",
    coming:
      "http://31.97.228.29:8000/storage/v1/object/public/audios/static/kn/as_kn.mp3",
    comingFileName: "as_kn.mp3",
  },
  { code: "ml", label: "Malayalam", current: "", next: "", coming: "" },
  { code: "mr", label: "Marathi", current: "", next: "", coming: "" },
  { code: "or", label: "Odia", current: "", next: "", coming: "" },
  { code: "pa", label: "Punjabi", current: "", next: "", coming: "" },
  {
    code: "ta",
    label: "Tamil",
    current:
      "http://31.97.228.29:8000/storage/v1/object/public/audios/static/ta/cs_ta.mp3",
    currentFileName: "cs_ta.mp3",
    next: "http://31.97.228.29:8000/storage/v1/object/public/audios/static/ta/ns_ta.mp3",
    nextFileName: "ns_ta.mp3",
    coming:
      "http://31.97.228.29:8000/storage/v1/object/public/audios/static/ta/as_ta.mp3",
    comingFileName: "as_ta.mp3",
  },
  {
    code: "te",
    label: "Telugu",
    current:
      "http://31.97.228.29:8000/storage/v1/object/public/audios/static/te/cs_te.mp3",
    currentFileName: "cs_te.mp3",
    next: "http://31.97.228.29:8000/storage/v1/object/public/audios/static/te/ns_te.mp3",
    nextFileName: "ns_te.mp3",
    coming:
      "http://31.97.228.29:8000/storage/v1/object/public/audios/static/te/as_te.mp3",
    comingFileName: "as_te.mp3",
  },
  { code: "ur", label: "Urdu", current: "", next: "", coming: "" },
  { code: "ks", label: "Kashmiri", current: "", next: "", coming: "" },
  { code: "kok", label: "Konkani", current: "", next: "", coming: "" },
  { code: "mai", label: "Maithili", current: "", next: "", coming: "" },
  { code: "mn", label: "Manipuri", current: "", next: "", coming: "" },
  { code: "ne", label: "Nepali", current: "", next: "", coming: "" },
  { code: "sa", label: "Sanskrit", current: "", next: "", coming: "" },
  { code: "sd", label: "Sindhi", current: "", next: "", coming: "" },
  { code: "si", label: "Sinhala", current: "", next: "", coming: "" },
  { code: "bho", label: "Bhojpuri", current: "", next: "", coming: "" },
  { code: "doi", label: "Dogri", current: "", next: "", coming: "" },
  { code: "gom", label: "Goan Konkani", current: "", next: "", coming: "" },
  { code: "sat", label: "Santali", current: "", next: "", coming: "" },
  { code: "mni", label: "Meitei (Manipuri)", current: "", next: "", coming: "" },
  { code: "brx", label: "Bodo", current: "", next: "", coming: "" },
  { code: "raj", label: "Rajasthani", current: "", next: "", coming: "" },
  { code: "chy", label: "Chhattisgarhi", current: "", next: "", coming: "" },
];

