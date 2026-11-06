import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeSyncAnnouncementText,
  getTransliteratedAnnouncementText,
  generateRouteStopRecords,
  generateRouteStageAudioRecords,
  transliterateStopText,
  transliterationCache,
  type RouteSimStopOption,
} from "../utils/routeAnnouncementTransliteration";
import * as transliterationModule from "@/shared/utils/transliteration";
import * as bitmapModule from "@/features/bitmap/services/bitmapService";
import type { IStageAudio } from "@/shared/types/stageAudio";

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

  describe("generateRouteStopRecords", () => {
    it("generates structured stop records with only the required fields", async () => {
      vi.spyOn(transliterationModule, "fetchTransliteration").mockResolvedValue(["गच्चीबौली"]);
      vi.spyOn(bitmapModule, "fetchBitmapMatrix").mockResolvedValue("00110011");

      const depotStops = [
        {
          id: "depot-s1",
          name: "Majestic BS",
          name_kn: "ಮೆಜೆಸ್ಟಿಕ್",
          stop_audios: [{ url: "http://storage/majestic.mp3", file_name: "majestic.mp3" }],
          up_latitude: "12.9767",
          up_longitude: "77.5713",
        },
      ];

      const records = await generateRouteStopRecords({
        stops: [
          {
            id: "depot-s1",
            name: "Majestic BS",
            label: "Majestic BS",
            group: "via",
          },
        ],
        languages: ["en", "kn", "hi"],
        depotStops,
        getFontFamily: () => "Arial",
      });

      expect(records).toHaveLength(1);
      const stopRecord = records[0];

      // Must have strictly the requested fields
      expect(stopRecord.stopId).toBe("depot-s1");
      expect(stopRecord.stopName).toBe("Majestic BS");
      expect(stopRecord.audioFileUrl).toBe("http://storage/majestic.mp3");
      expect(stopRecord.audioFileName).toBe("majestic.mp3");
      expect(stopRecord.latitude).toBe(12.9767);
      expect(stopRecord.longitude).toBe(77.5713);

      // Must NOT contain unneeded simulation fields
      expect((stopRecord as any).format).toBeUndefined();
      expect((stopRecord as any).texts).toBeUndefined();
      expect((stopRecord as any).width).toBeUndefined();
      expect((stopRecord as any).height).toBeUndefined();
      expect((stopRecord as any).scrollType).toBeUndefined();
      expect((stopRecord as any).stopType).toBeUndefined();

      // Languages array validation
      expect(stopRecord.languages).toHaveLength(3);

      // 1. English
      expect(stopRecord.languages[0]).toEqual({
        language: "en",
        translitaratedtext: "Majestic BS",
        bitmap: "00110011",
      });

      // 2. Kannada (uses catalog name_kn directly)
      expect(stopRecord.languages[1]).toEqual({
        language: "kn",
        translitaratedtext: "ಮೆಜೆಸ್ಟಿಕ್",
        bitmap: "00110011",
      });

      // 3. Hindi (transliterated via API)
      expect(stopRecord.languages[2]).toEqual({
        language: "hi",
        translitaratedtext: "गच्चीबौली",
        bitmap: "00110011",
      });
    });
  });

  describe("generateRouteStageAudioRecords", () => {
    it("generates structured stage audio records for current, next, and arriving across desired languages", async () => {
      vi.spyOn(bitmapModule, "fetchBitmapMatrix").mockResolvedValue("11001100");

      const customDbStageAudios: IStageAudio[] = [
        {
          id: "sa-1",
          language: "kn",
          stage_type: "current_stop",
          stage_label: "Current Stop",
          reference_text: "Current Stop Is",
          announcement_text: "ಕಸ್ಟಮ್ ಪ್ರಸ್ತುತ ನಿಲ್ದಾಣ",
          file_name: "custom_cs_kn.mp3",
          file_size: 1024,
          file_format: "mp3",
          url: "http://storage/custom_cs_kn.mp3",
          storage_path: "stage_audios/custom_cs_kn.mp3",
          created_at: new Date().toISOString(),
        },
      ];

      const records = await generateRouteStageAudioRecords({
        languages: ["en", "kn"],
        stageAudios: customDbStageAudios,
        getFontFamily: () => "TestFont",
      });

      expect(records).toHaveLength(3);

      // Verify stages structure & deterministic ordering
      expect(records[0].stage).toBe("current");
      expect(records[0].stageLabel).toBe("Current Stop");
      expect(records[1].stage).toBe("next");
      expect(records[1].stageLabel).toBe("Next Stop");
      expect(records[2].stage).toBe("arriving");
      expect(records[2].stageLabel).toBe("Arriving Stop");

      // Verify Current Stop records
      const currentStage = records[0];
      expect(currentStage.languages).toHaveLength(2);

      // 1. English (falls back to static presets for URL and natural STAGE_PRESET)
      expect(currentStage.languages[0].language).toBe("en");
      expect(currentStage.languages[0].text).toBe("Current stop is");
      expect(currentStage.languages[0].audioFileUrl).toContain("current_stop_en.mp3");
      expect(currentStage.languages[0].audioFileName).toBe("current_stop_en.mp3");
      expect(currentStage.languages[0].bitmap).toBe("11001100");

      // 2. Kannada (uses DB override for custom announcement_text and URL)
      expect(currentStage.languages[1].language).toBe("kn");
      expect(currentStage.languages[1].text).toBe("ಕಸ್ಟಮ್ ಪ್ರಸ್ತುತ ನಿಲ್ದಾಣ");
      expect(currentStage.languages[1].audioFileUrl).toBe("http://storage/custom_cs_kn.mp3");
      expect(currentStage.languages[1].audioFileName).toBe("custom_cs_kn.mp3");
      expect(currentStage.languages[1].bitmap).toBe("11001100");

      // Verify Next Stop records (no DB override, uses STAGE_PRESETS and static URLs)
      const nextStage = records[1];
      expect(nextStage.languages[0].language).toBe("en");
      expect(nextStage.languages[0].text).toBe("Next stop is");
      expect(nextStage.languages[0].audioFileName).toBe("next_stop_en.mp3");

      expect(nextStage.languages[1].language).toBe("kn");
      expect(nextStage.languages[1].text).toBe("ಮುಂದಿನ ನಿಲ್ದಾಣ");
      expect(nextStage.languages[1].audioFileName).toBe("ns_kn.mp3");

      // Verify Arriving Stop records
      const arrivingStage = records[2];
      expect(arrivingStage.languages[0].language).toBe("en");
      expect(arrivingStage.languages[0].text).toBe("Arriving at");
      expect(arrivingStage.languages[0].audioFileName).toBe("arriving_stop_en.mp3");

      expect(arrivingStage.languages[1].language).toBe("kn");
      expect(arrivingStage.languages[1].text).toBe("ತಲುಪುತ್ತಿರುವ ನಿಲ್ದಾಣ");
      expect(arrivingStage.languages[1].audioFileName).toBe("as_kn.mp3");
    });

    it("defaults to English when empty languages array is passed", async () => {
      vi.spyOn(bitmapModule, "fetchBitmapMatrix").mockResolvedValue("0011");

      const records = await generateRouteStageAudioRecords({
        languages: [],
      });

      expect(records).toHaveLength(3);
      expect(records[0].languages).toHaveLength(1);
      expect(records[0].languages[0].language).toBe("en");
    });

    it("passes custom fontHeight (e.g. 32) to fetchBitmapMatrix", async () => {
      const bitmapSpy = vi.spyOn(bitmapModule, "fetchBitmapMatrix").mockResolvedValue("11110000");

      await generateRouteStageAudioRecords({
        languages: ["en"],
        fontHeight: 32,
      });

      expect(bitmapSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          height: 32,
        })
      );
    });
  });
});

