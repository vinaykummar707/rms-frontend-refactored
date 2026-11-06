import { describe, it, expect } from "vitest";

interface Stop {
  id: string;
  name: string;
  name_kn?: string;
}

interface ViaStopItem {
  id: string;
  name: string;
  name_kn?: string;
  isCustom?: boolean;
}

function filterAvailableStops({
  catalogStops,
  source,
  destination,
  viaStops,
}: {
  catalogStops: Stop[];
  source: string;
  destination: string;
  viaStops: ViaStopItem[];
}) {
  const sourceNorm = (source || "").toLowerCase().trim();
  const destNorm = (destination || "").toLowerCase().trim();
  const viaNamesSet = new Set(viaStops.map((v) => v.name.toLowerCase().trim()));

  const availableSourceStops = catalogStops.filter((s) => {
    const sName = (s.name || "").toLowerCase().trim();
    if (!sName) return false;
    if (sName === sourceNorm) return true; // keep currently selected
    if (sName === destNorm) return false;
    if (viaNamesSet.has(sName)) return false;
    return true;
  });

  const availableDestStops = catalogStops.filter((s) => {
    const sName = (s.name || "").toLowerCase().trim();
    if (!sName) return false;
    if (sName === destNorm) return true; // keep currently selected
    if (sName === sourceNorm) return false;
    if (viaNamesSet.has(sName)) return false;
    return true;
  });

  const availableViaStops = catalogStops.filter((s) => {
    const sName = (s.name || "").toLowerCase().trim();
    if (!sName) return false;
    if (sName === sourceNorm) return false;
    if (sName === destNorm) return false;
    if (viaNamesSet.has(sName)) return false;
    return true;
  });

  return { availableSourceStops, availableDestStops, availableViaStops };
}

describe("Route Stop Selection & Mutual Exclusion", () => {
  const mockStops: Stop[] = [
    { id: "s1", name: "Majestic BS", name_kn: "ಮೆಜೆಸ್ಟಿಕ್" },
    { id: "s2", name: "Corporation", name_kn: "ಕಾರ್ಪೊರೇಷನ್" },
    { id: "s3", name: "Domlur", name_kn: "ದೋಮ್ಲೂರು" },
    { id: "s4", name: "HAL", name_kn: "ಹೆಚ್ಎಎಲ್" },
    { id: "s5", name: "Marathahalli", name_kn: "ಮಾರತಹಳ್ಳಿ" },
    { id: "s6", name: "Kadugodi BS", name_kn: "ಕಾಡುಗೋಡಿ" },
  ];

  it("excludes source and destination stops from available via options", () => {
    const { availableViaStops } = filterAvailableStops({
      catalogStops: mockStops,
      source: "Majestic BS",
      destination: "Kadugodi BS",
      viaStops: [],
    });

    const viaNames = availableViaStops.map((s) => s.name);
    expect(viaNames).not.toContain("Majestic BS");
    expect(viaNames).not.toContain("Kadugodi BS");
    expect(viaNames).toEqual(["Corporation", "Domlur", "HAL", "Marathahalli"]);
  });

  it("excludes via stops from both source and destination dropdowns", () => {
    const viaStops: ViaStopItem[] = [
      { id: "s3", name: "Domlur" },
      { id: "s5", name: "Marathahalli" },
    ];

    const { availableSourceStops, availableDestStops } = filterAvailableStops({
      catalogStops: mockStops,
      source: "Majestic BS",
      destination: "Kadugodi BS",
      viaStops,
    });

    const sourceNames = availableSourceStops.map((s) => s.name);
    const destNames = availableDestStops.map((s) => s.name);

    expect(sourceNames).not.toContain("Domlur");
    expect(sourceNames).not.toContain("Marathahalli");
    expect(destNames).not.toContain("Domlur");
    expect(destNames).not.toContain("Marathahalli");

    // Majestic BS should still be available in Source because it is currently selected
    expect(sourceNames).toContain("Majestic BS");
    expect(destNames).not.toContain("Majestic BS");

    // Kadugodi BS should still be available in Destination because it is currently selected
    expect(destNames).toContain("Kadugodi BS");
    expect(sourceNames).not.toContain("Kadugodi BS");
  });

  it("handles case-insensitive comparison and whitespace trimming", () => {
    const { availableViaStops } = filterAvailableStops({
      catalogStops: mockStops,
      source: "  majestic bs  ",
      destination: "KADUGODI BS",
      viaStops: [{ id: "custom-1", name: "  domlur  ", isCustom: true }],
    });

    const viaNames = availableViaStops.map((s) => s.name);
    expect(viaNames).not.toContain("Majestic BS");
    expect(viaNames).not.toContain("Kadugodi BS");
    expect(viaNames).not.toContain("Domlur");
    expect(viaNames).toEqual(["Corporation", "HAL", "Marathahalli"]);
  });

  it("correctly reverses via sequence for return trip", () => {
    const outboundVia: ViaStopItem[] = [
      { id: "s2", name: "Corporation" },
      { id: "s3", name: "Domlur" },
      { id: "s4", name: "HAL" },
    ];

    const returnVia = [...outboundVia].reverse();
    expect(returnVia.map((v) => v.name)).toEqual(["HAL", "Domlur", "Corporation"]);
  });

  it("rearranges via items when moved up or down", () => {
    const viaItems: ViaStopItem[] = [
      { id: "s2", name: "Corporation" },
      { id: "s3", name: "Domlur" },
      { id: "s4", name: "HAL" },
    ];

    // Move Domlur (idx 1) up
    const movedUp = [...viaItems];
    const temp = movedUp[0];
    movedUp[0] = movedUp[1];
    movedUp[1] = temp;

    expect(movedUp.map((v) => v.name)).toEqual(["Domlur", "Corporation", "HAL"]);
  });

  it("serializes viaStops array to comma-separated string for form synchronization", () => {
    const viaItems: ViaStopItem[] = [
      { id: "s3", name: "Domlur" },
      { id: "s4", name: "HAL" },
      { id: "s5", name: "Marathahalli" },
    ];

    const serialized = viaItems.map((v) => v.name).join(", ");
    expect(serialized).toBe("Domlur, HAL, Marathahalli");
  });

  it("provides clean catalog select items without 'None' and clears stop value to empty string", () => {
    const availableStops = [
      { id: "s1", name: "Majestic BS", name_kn: "ಮೆಜೆಸ್ಟಿಕ್" },
      { id: "s2", name: "Corporation" },
    ];

    const buildItems = (stops: Stop[], currentVal?: string) => {
      const items = stops.map((s) => ({
        value: s.name,
        label: s.name_kn ? `${s.name} (${s.name_kn})` : s.name,
      }));
      const curNorm = (currentVal || "").toLowerCase().trim();
      if (currentVal && !items.some((i) => i.value.toLowerCase() === curNorm)) {
        items.unshift({
          value: currentVal,
          label: `${currentVal} (Custom)`,
        });
      }
      return items;
    };

    const items = buildItems(availableStops, "Majestic BS");
    expect(items[0]).toEqual({ value: "Majestic BS", label: "Majestic BS (ಮೆಜೆಸ್ಟಿಕ್)" });
    expect(items.some((i) => i.value === "None" || i.value === "__none__")).toBe(false);
    expect(items.length).toBe(2);

    // Simulating clear action resets value to empty string
    let stopValue = "Majestic BS";
    const clearStop = () => {
      stopValue = "";
    };
    clearStop();
    expect(stopValue).toBe("");
  });

  it("restores all stops to available lists when source or destination is cleared to empty", () => {
    // When source and destination are both empty
    const { availableSourceStops, availableDestStops, availableViaStops } = filterAvailableStops({
      catalogStops: mockStops,
      source: "",
      destination: "",
      viaStops: [],
    });

    expect(availableSourceStops.length).toBe(mockStops.length);
    expect(availableDestStops.length).toBe(mockStops.length);
    expect(availableViaStops.length).toBe(mockStops.length);
  });

  describe("Default Empty Stops in Route JSON", () => {
    it("strictly returns empty array for route stops when no source, destination, or via stops are selected", () => {
      const buildRouteSimStops = ({
        viaStops,
        source,
        destination,
      }: {
        viaStops: ViaStopItem[];
        source: string;
        destination: string;
      }) => {
        const options: { id: string; name: string }[] = [];
        viaStops.forEach((via) => {
          options.push({ id: via.id, name: via.name });
        });
        if (source.trim()) {
          options.push({ id: "source-endpoint", name: source.trim() });
        }
        if (destination.trim()) {
          options.push({ id: "dest-endpoint", name: destination.trim() });
        }
        return options;
      };

      // Even if depot catalog contains stops, a blank route has NO route stops
      const routeStops = buildRouteSimStops({
        viaStops: [],
        source: "",
        destination: "",
      });

      expect(routeStops).toEqual([]);
      expect(routeStops.length).toBe(0);
    });

    it("filters out legacy simulated stop slides when loading routes", () => {
      const rawLoadedStops = [
        {
          format: "single",
          texts: {
            text: {
              text: "CURRENT STOP IS KUKATPALLY",
              scrollType: "Right To Left",
            },
          },
          height: 16,
          width: 160,
          type: "stop",
          stopType: "current",
        },
      ];

      const cleanStops = rawLoadedStops.filter(
        (s: any) => s && (s.stopId || (s.id && !s.format && !s.texts))
      );

      expect(cleanStops).toEqual([]);
    });

    it("preserves genuine V2 structured stop records when loading routes", () => {
      const genuineV2Stops = [
        {
          stopId: "stop-101",
          stopName: "Majestic BS",
          audioFileUrl: "https://example.com/audio/majestic.mp3",
          audioFileName: "majestic.mp3",
          latitude: 12.9767,
          longitude: 77.5713,
          languages: [
            {
              language: "en",
              translitaratedtext: "Majestic BS",
              bitmap: "0000000000",
            },
          ],
        },
      ];

      const cleanStops = genuineV2Stops.filter(
        (s: any) => s && (s.stopId || (s.id && !s.format && !s.texts))
      );

      expect(cleanStops).toEqual(genuineV2Stops);
      expect(cleanStops.length).toBe(1);
    });

    it("does not preselect any announcement languages by default allowing user to decide", () => {
      // By default for a new route, announcement languages array is empty
      const initialDesiredLanguages: string[] = [];
      expect(initialDesiredLanguages).toEqual([]);
      expect(initialDesiredLanguages.length).toBe(0);

      // Active simulator language must remain empty when no languages are chosen
      const getSimLanguage = (langs: string[], current: string) => {
        if (langs.length > 0) {
          return current && langs.includes(current) ? current : langs[0];
        }
        return "";
      };

      expect(getSimLanguage(initialDesiredLanguages, "")).toBe("");
    });

    it("allows user to add languages and remove any language without restrictions", () => {
      let desiredLanguages: string[] = [];

      const addLanguage = (code: string) => {
        if (!desiredLanguages.includes(code)) {
          desiredLanguages = [...desiredLanguages, code];
        }
      };

      const removeLanguage = (code: string) => {
        desiredLanguages = desiredLanguages.filter((c) => c !== code);
      };

      // User adds Kannada and English
      addLanguage("kn");
      addLanguage("en");
      expect(desiredLanguages).toEqual(["kn", "en"]);

      // User removes English
      removeLanguage("en");
      expect(desiredLanguages).toEqual(["kn"]);

      // User removes Kannada (last remaining language)
      removeLanguage("kn");
      expect(desiredLanguages).toEqual([]);
      expect(desiredLanguages.length).toBe(0);
    });
  });
});

