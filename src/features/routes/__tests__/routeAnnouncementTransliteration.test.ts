import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeSyncAnnouncementText,
  getTransliteratedAnnouncementText,
  transliterateStopText,
  transliterationCache,
  type RouteSimStopOption,
} from "../utils/routeAnnouncementTransliteration";
import * as transliterationModule from "@/shared/utils/transliteration";

describe("Route Announcement Transliteration", () => {
  const sampleStopWithKn: RouteSimStopOption = {
    id: "s1",
    name: "Majestic BS",
    name_kn: "ಮೆಜೆಸ್ಟಿಕ್ ಬಸ್ ನಿಲ್ದಾಣ",
    label: "Majestic BS (ಮೆಜೆಸ್ಟಿಕ್ ಬಸ್ ನಿಲ್ದಾಣ)",
    group: "via",
  };

  const sampleStopEnglishOnly: RouteSimStopOption = {
    id: "s2",
    name: "Gachibowli",
    label: "Gachibowli",
    group: "via",
  };

  beforeEach(() => {
    transliterationCache.clear();
    vi.restoreAllMocks();
  });

  describe("computeSyncAnnouncementText", () => {
    it("formats English announcement in uppercase with correct stage prefixes", () => {
      expect(
        computeSyncAnnouncementText(sampleStopEnglishOnly, "current", "en")
      ).toBe("CURRENT STOP IS GACHIBOWLI");

      expect(
        computeSyncAnnouncementText(sampleStopEnglishOnly, "next", "en-IN")
      ).toBe("NEXT STOP IS GACHIBOWLI");

      expect(
        computeSyncAnnouncementText(sampleStopEnglishOnly, "arriving", "en")
      ).toBe("ARRIVING AT GACHIBOWLI");
    });

    it("uses native regional stop name for Kannada when present in database", () => {
      expect(
        computeSyncAnnouncementText(sampleStopWithKn, "current", "kn")
      ).toBe("ಪ್ರಸ್ತುತ ನಿಲ್ದಾಣ ಮೆಜೆಸ್ಟಿಕ್ ಬಸ್ ನಿಲ್ದಾಣ");

      expect(
        computeSyncAnnouncementText(sampleStopWithKn, "next", "kn-IN")
      ).toBe("ಮುಂದಿನ ನಿಲ್ದಾಣ ಮೆಜೆಸ್ಟಿಕ್ ಬಸ್ ನಿಲ್ದಾಣ");
    });

    it("uses cached transliteration if already resolved previously", () => {
      transliterationCache.set("hi:gachibowli", "गच्चीबौली");

      const result = computeSyncAnnouncementText(
        sampleStopEnglishOnly,
        "current",
        "hi"
      );
      expect(result).toBe("वर्तमान स्टॉप है गच्चीबौली");
    });

    it("falls back to stop name with localized stage preset when not yet cached", () => {
      const result = computeSyncAnnouncementText(
        sampleStopEnglishOnly,
        "next",
        "te"
      );
      expect(result).toBe("తదుపరి స్టాప్ Gachibowli");
    });
  });

  describe("transliterateStopText & getTransliteratedAnnouncementText", () => {
    it("returns clean text immediately for English without calling API", async () => {
      const spy = vi.spyOn(transliterationModule, "fetchTransliteration");
      const result = await transliterateStopText("Majestic", "en");

      expect(result).toBe("Majestic");
      expect(spy).not.toHaveBeenCalled();
    });

    it("transliterates stop name using fetchTransliteration and caches result", async () => {
      const spy = vi
        .spyOn(transliterationModule, "fetchTransliteration")
        .mockResolvedValueOnce(["गच्चीबौली", "गच्चीबाउली"]);

      const text = await transliterateStopText("Gachibowli", "hi");
      expect(text).toBe("गच्चीबौली");
      expect(spy).toHaveBeenCalledWith("Gachibowli", "hi");

      // Repeated call should serve from cache without calling API again
      const text2 = await transliterateStopText("Gachibowli", "hi");
      expect(text2).toBe("गच्चीबौली");
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("resolves full announcement text translated to Hindi", async () => {
      vi.spyOn(transliterationModule, "fetchTransliteration").mockResolvedValueOnce([
        "गच्चीबौली",
      ]);

      const announcement = await getTransliteratedAnnouncementText(
        sampleStopEnglishOnly,
        "current",
        "hi"
      );

      expect(announcement).toBe("वर्तमान स्टॉप है गच्चीबौली");
    });

    it("resolves full announcement text translated to Telugu", async () => {
      vi.spyOn(transliterationModule, "fetchTransliteration").mockResolvedValueOnce([
        "గచ్చిబౌలి",
      ]);

      const announcement = await getTransliteratedAnnouncementText(
        sampleStopEnglishOnly,
        "next",
        "te"
      );

      expect(announcement).toBe("తదుపరి స్టాప్ గచ్చిబౌలి");
    });

    it("falls back gracefully to stop name if transliteration returns empty or fails", async () => {
      vi.spyOn(transliterationModule, "fetchTransliteration").mockResolvedValueOnce([]);

      const announcement = await getTransliteratedAnnouncementText(
        sampleStopEnglishOnly,
        "arriving",
        "hi"
      );

      expect(announcement).toBe("आने वाला स्टॉप है Gachibowli");
    });
  });
});

