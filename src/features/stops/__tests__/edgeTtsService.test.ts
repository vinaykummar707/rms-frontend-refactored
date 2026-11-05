import { describe, it, expect } from "vitest";
import {
  INDIAN_LANGUAGES,
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE,
  resolveVoice,
  createSyntheticWavBlob,
  getTtsApiUrl,
} from "../services/edgeTtsService";
import { normalizeStopNameForSpeech } from "../../../../server/ttsServer";

describe("Edge-TTS Service & Voice Catalog", () => {
  it("should have English (India) as the default language and Neerja as default voice", () => {
    expect(DEFAULT_LANGUAGE).toBe("en-IN");
    expect(DEFAULT_VOICE).toBe("en-IN-NeerjaNeural");
  });

  it("should support 10 Indian regional languages in the catalog", () => {
    expect(INDIAN_LANGUAGES.length).toBe(10);
    const codes = INDIAN_LANGUAGES.map((l) => l.code);
    expect(codes).toContain("en-IN");
    expect(codes).toContain("hi-IN");
    expect(codes).toContain("kn-IN");
    expect(codes).toContain("te-IN");
    expect(codes).toContain("ta-IN");
    expect(codes).toContain("ml-IN");
    expect(codes).toContain("mr-IN");
    expect(codes).toContain("gu-IN");
    expect(codes).toContain("bn-IN");
    expect(codes).toContain("ur-IN");
  });

  it("should resolve voice by language and gender correctly", () => {
    // English default
    expect(resolveVoice("en-IN", "female")).toBe("en-IN-NeerjaNeural");
    expect(resolveVoice("en-IN", "male")).toBe("en-IN-PrabhatNeural");

    // Hindi
    expect(resolveVoice("hi-IN", "female")).toBe("hi-IN-SwaraNeural");
    expect(resolveVoice("hi-IN", "male")).toBe("hi-IN-MadhurNeural");

    // Kannada
    expect(resolveVoice("kn-IN", "female")).toBe("kn-IN-SapnaNeural");
    expect(resolveVoice("kn-IN", "male")).toBe("kn-IN-GaganNeural");

    // Telugu
    expect(resolveVoice("te-IN", "female")).toBe("te-IN-ShrutiNeural");
    expect(resolveVoice("te-IN", "male")).toBe("te-IN-MohanNeural");

    // Fallback on missing or invalid code
    expect(resolveVoice(undefined, "female")).toBe("en-IN-NeerjaNeural");
  });

  it("should generate a valid PCM mono WAV blob for synthetic fallback", () => {
    const blob = createSyntheticWavBlob(0.5, 440);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBeGreaterThan(44);
  });

  it("should normalize stop names for speech and expand transit abbreviations", () => {
    // ALL CAPS to Title Case
    expect(normalizeStopNameForSpeech("MAJESTIC BUS STATION")).toBe("Majestic Bus Station");

    // Abbreviation expansion
    expect(normalizeStopNameForSpeech("KBS B/S")).toBe("Kbs Bus Stop");
    expect(normalizeStopNameForSpeech("CITY RLY STN")).toBe("City Railway Station");
    expect(normalizeStopNameForSpeech("TOWN JN")).toBe("Town Junction");
    expect(normalizeStopNameForSpeech("GOVT HOSP")).toBe("Government Hospital");

    // Regional Indic scripts preserved without corruption
    expect(normalizeStopNameForSpeech("ಕೆಂಪೇಗೌಡ ಬಸ್ ನಿಲ್ದಾಣ")).toBe("ಕೆಂಪೇಗೌಡ ಬಸ್ ನಿಲ್ದಾಣ");
    expect(normalizeStopNameForSpeech("शिवाजी नगर")).toBe("शिवाजी नगर");
  });

  it("should resolve TTS API URL properly in dev and custom configurations", () => {
    expect(getTtsApiUrl("/api/tts/synthesize")).toBe("/api/tts/synthesize");
  });
});
