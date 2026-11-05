import { describe, it, expect } from "vitest";
import { exportAudiosToZip } from "../audioExport";

describe("Audio Export to ZIP Utility", () => {
  it("should reject when no audio items are provided", async () => {
    await expect(exportAudiosToZip([], "test.zip")).rejects.toThrow(
      "No available audio recordings to export."
    );
  });

  it("should reject when all audio items have empty URLs", async () => {
    await expect(
      exportAudiosToZip(
        [
          { url: "", fileName: "a.mp3" },
          { url: "   ", fileName: "b.mp3" },
        ],
        "test.zip"
      )
    ).rejects.toThrow("No available audio recordings to export.");
  });
});

