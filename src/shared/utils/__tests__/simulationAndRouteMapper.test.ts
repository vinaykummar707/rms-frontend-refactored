import { describe, it, expect } from "vitest";
import {
  sanitizeSimulation,
  joinSourceDestination,
  getRoutePresetZoneText,
} from "../simulationUtils";
import {
  convertV2ToV1,
  convertV1ToDbRoute,
} from "../routeConfigMapper";
import type { Simulation } from "@/shared/types/routeConfigV2";

describe("Simulation Utilities & Route Config Mapper", () => {
  const sampleSlide: Simulation = {
    type: "route",
    format: "three",
    height: 16,
    width: 96,
    texts: {
      sideText: { text: "101", language: "en", fontHeight: 16, scrollType: "None", position: "Center", scrollSpeed: "5", fontWeight: "Regular" },
      upperHalfText: { text: "MAJESTIC", language: "en", fontHeight: 8, scrollType: "None", position: "Center", scrollSpeed: "5", fontWeight: "Regular" },
      lowerHalfText: { text: "AIRPORT", language: "en", fontHeight: 8, scrollType: "None", position: "Center", scrollSpeed: "5", fontWeight: "Regular" },
      text: { text: "VIA HEBBAL", language: "en", fontHeight: 16, scrollType: "None", position: "Center", scrollSpeed: "5", fontWeight: "Regular" },
    } as any,
  };

  it("sanitizes slide text keys according to format and split-route mode", () => {
    // When format is 'three' and isSplitRoute is true, sideText is removed and upperHalfText is retained
    const splitSlide = sanitizeSimulation(sampleSlide, true);
    const splitTexts = splitSlide.texts as any;
    expect(splitTexts.sideText).toBeUndefined();
    expect(splitTexts.upperHalfText?.text).toBe("MAJESTIC");

    // When format is 'single', only texts.text is kept
    const singleSlide: Simulation = {
      ...sampleSlide,
      format: "single",
    };
    const sanitizedSingle = sanitizeSimulation(singleSlide, false);
    const singleTexts = sanitizedSingle.texts as any;
    expect(singleTexts.upperHalfText).toBeUndefined();
    expect(singleTexts.sideText).toBeUndefined();
    expect(singleTexts.text?.text).toBe("VIA HEBBAL");
  });

  it("joins source and destination using standard separators", () => {
    const joined = joinSourceDestination("KEMPEGOWDA", "AIRPORT", "TO");
    expect(joined).toBe("KEMPEGOWDA TO AIRPORT");

    const defaultJoined = joinSourceDestination("MAJESTIC", "SHIVAJINAGAR");
    expect(defaultJoined).toBe("MAJESTIC - SHIVAJINAGAR");
  });

  it("generates route preset zone text correctly", () => {
    const values = {
      routeNumber: "500-D",
      source: "HEBBAL",
      destination: "SILK BOARD",
      via: "MARATHAHALLI",
      separation: "↔",
    };

    const sideText = getRoutePresetZoneText("two", "sideText", values);
    expect(sideText).toBe("500-D");

    const upperText = getRoutePresetZoneText("three", "upperHalfText", values);
    expect(upperText).toBe("HEBBAL ↔ SILK BOARD");

    const lowerText = getRoutePresetZoneText("three", "lowerHalfText", values);
    expect(lowerText).toBe("MARATHAHALLI");
  });

  it("maps V2 route configuration into V1 route payload and back", () => {
    const v2Config = {
      display: { width: 96, height: 16 },
      route_number: "401-K",
      source: "YELAHANKA",
      destination: "KENGERI",
      is_split_route: false,
      is_dual_screen: false,
      slides: [sampleSlide],
    };

    const v1Route = convertV2ToV1(v2Config);
    expect(v1Route.route?.routeNumber).toBe("401-K");
    expect(v1Route.route?.source).toBe("YELAHANKA");
    expect(v1Route.route?.destination).toBe("KENGERI");

    const dbPayload = convertV1ToDbRoute(v1Route, {
      depotId: "depot-1",
      userId: "user-1",
    });
    expect(dbPayload.route_number).toBe("401-K");
    expect(dbPayload.depot_id).toBe("depot-1");
    expect(dbPayload.created_by).toBe("user-1");
  });
});
