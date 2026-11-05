import { describe, it, expect } from "vitest";
import {
  slugifyText,
  uploadPremadeAudioFile,
  generateAndUploadPremadeAudio,
  generatePremadeAudioFile,
} from "../services/premadeAudioService";
import { resolveVoice } from "@/features/stops/services/edgeTtsService";

describe("Premade Audio Service & Helpers", () => {
  it("should slugify reference text into filesystem-safe filenames", () => {
    expect(slugifyText("Attention Passengers")).toBe("attention-passengers");
    expect(slugifyText("Next Stop: Majestic Bus Station #1")).toBe("next-stop-majestic-bus-station-1");
    expect(slugifyText("   Multiple   Spaces   ")).toBe("multiple-spaces");
    expect(slugifyText("Special !@#$%^&*() Characters")).toBe("special-characters");
  });

  it("should reject uploading premade audio with empty reference text", async () => {
    const dummyFile = new File(["dummy audio content"], "test.mp3", { type: "audio/mpeg" });
    await expect(uploadPremadeAudioFile(dummyFile, "")).rejects.toThrow(
      "Reference text is required for premade audio."
    );
    await expect(uploadPremadeAudioFile(dummyFile, "   ")).rejects.toThrow(
      "Reference text is required for premade audio."
    );
  });

  it("should reject synthesizing premade audio with empty announcement or reference text", async () => {
    await expect(generateAndUploadPremadeAudio("", "Ref Title")).rejects.toThrow(
      "Announcement speech text cannot be empty."
    );
    await expect(generateAndUploadPremadeAudio("Spoken Speech", "")).rejects.toThrow(
      "Reference text is required."
    );
    await expect(generatePremadeAudioFile("", "Ref Title")).rejects.toThrow(
      "Announcement speech text cannot be empty."
    );
    await expect(generatePremadeAudioFile("Spoken Speech", "")).rejects.toThrow(
      "Reference text is required."
    );
  });

  it("should resolve proper neural voice for all Indian languages", () => {
    expect(resolveVoice("en-IN", "female")).toBe("en-IN-NeerjaNeural");
    expect(resolveVoice("en-IN", "male")).toBe("en-IN-PrabhatNeural");
    expect(resolveVoice("hi-IN", "female")).toBe("hi-IN-SwaraNeural");
    expect(resolveVoice("hi-IN", "male")).toBe("hi-IN-MadhurNeural");
    expect(resolveVoice("kn-IN", "female")).toBe("kn-IN-SapnaNeural");
    expect(resolveVoice("kn-IN", "male")).toBe("kn-IN-GaganNeural");
  });
});
