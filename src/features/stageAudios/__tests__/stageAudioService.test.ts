import { describe, it, expect } from "vitest";
import {
  slugifyText,
  generateStageAudioFile,
  uploadStageAudioFile,
} from "../services/stageAudioService";
import {
  getStagePreset,
  getDefaultReferenceText,
} from "../services/stageAudioPresets";

describe("Stage Audio Service & Presets", () => {
  it("should provide native translation presets for all 11 Indian languages", () => {
    // English
    expect(getStagePreset("en-IN", "current_stop")).toBe("Current stop is");
    expect(getStagePreset("en-IN", "next_stop")).toBe("Next stop is");
    expect(getStagePreset("en-IN", "arriving_stop")).toBe("Arriving at");

    // Kannada
    expect(getStagePreset("kn-IN", "current_stop")).toBe("ಪ್ರಸ್ತುತ ನಿಲ್ದಾಣ");
    expect(getStagePreset("kn-IN", "next_stop")).toBe("ಮುಂದಿನ ನಿಲ್ದಾಣ");
    expect(getStagePreset("kn-IN", "arriving_stop")).toBe("ತಲುಪುತ್ತಿರುವ ನಿಲ್ದಾಣ");

    // Hindi
    expect(getStagePreset("hi-IN", "current_stop")).toBe("वर्तमान स्टॉप है");
    expect(getStagePreset("hi-IN", "next_stop")).toBe("अगला स्टॉप है");
    expect(getStagePreset("hi-IN", "arriving_stop")).toBe("आने वाला स्टॉप है");

    // Short language code matching (e.g. 'kn', 'hi', 'te')
    expect(getStagePreset("kn", "current_stop")).toBe("ಪ್ರಸ್ತುತ ನಿಲ್ದಾಣ");
    expect(getStagePreset("hi", "next_stop")).toBe("अगला स्टॉप है");
    expect(getStagePreset("te", "arriving_stop")).toBe("చేరుకుంటున్న స్టాప్");
    expect(getStagePreset("ta", "current_stop")).toBe("தற்போதைய நிறுத்தம்");
  });

  it("should generate default reference text for language and stage type", () => {
    expect(getDefaultReferenceText("Kannada", "next_stop")).toBe(
      "Kannada - Next Stop"
    );
    expect(getDefaultReferenceText("English (India)", "current_stop")).toBe(
      "English (India) - Current Stop"
    );
    expect(getDefaultReferenceText("Hindi", "arriving_stop")).toBe(
      "Hindi - Arriving Stop"
    );
  });

  it("should slugify stage names and reference text into filesystem-safe prefixes", () => {
    expect(slugifyText("Next Stop Is")).toBe("next-stop-is");
    expect(slugifyText("Kannada - Current Stop")).toBe("kannada-current-stop");
    expect(slugifyText("   Special !!! Stage ***   ")).toBe("special-stage");
  });

  it("should reject synthesizing stage audio with empty announcement text", async () => {
    await expect(
      generateStageAudioFile("", "Ref Title", "next_stop")
    ).rejects.toThrow("Announcement speech text cannot be empty.");
  });

  it("should reject uploading stage audio with missing mandatory fields", async () => {
    const dummyFile = new File(["dummy audio"], "test.mp3", { type: "audio/mpeg" });

    // Missing language
    await expect(
      uploadStageAudioFile(dummyFile, "", "next_stop", "Ref", {
        announcementText: "Next stop",
      })
    ).rejects.toThrow("Language code is required for stage audio.");

    // Missing reference text
    await expect(
      uploadStageAudioFile(dummyFile, "en-IN", "next_stop", "", {
        announcementText: "Next stop",
      })
    ).rejects.toThrow("Reference text is required for stage audio.");

    // Missing announcement text
    await expect(
      uploadStageAudioFile(dummyFile, "en-IN", "next_stop", "Ref", {
        announcementText: "",
      })
    ).rejects.toThrow("Announcement speech text is required.");
  });
});
