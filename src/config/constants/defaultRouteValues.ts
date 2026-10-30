import type { IStopWithAudio } from "@/shared/types/stop";
import type { IRouteCreate } from "@/shared/types/route";
import {
  type SimulationType,
  type FontWeight,
  type ScrollType,
  type Position,
  type SingleSimulationTexts,
  type TwoSimulationTexts,
  type ThreeSimulationTexts,
  type Simulation,
  type StopRouteConfig,
  type StopState,
  DEFAULT_SIMULATION_HEIGHTS,
  DEFAULT_SIMULATION_WIDTHS,
} from "@/shared/types/routeConfigV2";
import { AVAILABLE_LANGUAGES } from "./languages";

// ---- Fundamental defaults ----
export const DEFAULT_SCROLL_TYPE: ScrollType = "Fixed";
export const DEFAULT_POSITION: Position = "Center";
export const DEFAULT_FONT_WEIGHT: FontWeight = "Bold";
export const DEFAULT_SCROLL_SPEED = 4;
export const DEFAULT_FONT_HEIGHT = 16;
export const DEFAULT_FONT_WIDTH = 12;
export const DEFAULT_SIMULATION_HEIGHT = DEFAULT_SIMULATION_HEIGHTS[0];
export const DEFAULT_SIMULATION_WIDTH = DEFAULT_SIMULATION_WIDTHS[3];
export const DEFAULT_SIMULATION_TYPE: SimulationType = "route";

// ---- Default TextConfig generator ----
export function getDefaultTextConfig(
  text: string = "Text"
): Omit<SingleSimulationTexts["text"], "bitmap"> & { bitmap?: string } {
  return {
    text,
    bitmap: "",
    fontWidth: DEFAULT_FONT_WIDTH,
    scrollType: DEFAULT_SCROLL_TYPE,
    position: DEFAULT_POSITION,
    scrollSpeed: DEFAULT_SCROLL_SPEED,
    fontWeight: DEFAULT_FONT_WEIGHT,
    fontHeight: DEFAULT_FONT_HEIGHT,
    language: "en",
    icon: "",
    iconPosition: "start",
    iconSpacing: 2,
    iconWidthScale: 1.0,
  };
}

export const defaultSingleSimulationTexts: SingleSimulationTexts = {
  text: getDefaultTextConfig("Main Text"),
};

export const defaultTwoSimulationTexts: TwoSimulationTexts = {
  sideText: getDefaultTextConfig("Side Text"),
  text: getDefaultTextConfig("Main Text"),
};

export const defaultThreeSimulationTexts: ThreeSimulationTexts = {
  sideText: getDefaultTextConfig("Side Text"),
  upperHalfText: getDefaultTextConfig("Upper Text"),
  lowerHalfText: getDefaultTextConfig("Lower Text"),
};

export function getDefaultSingleSimulation(
  text?: string,
  type: SimulationType = DEFAULT_SIMULATION_TYPE
): Simulation {
  return {
    format: "single",
    texts: {
      text: getDefaultTextConfig(text),
    },
    height: DEFAULT_SIMULATION_HEIGHT,
    width: DEFAULT_SIMULATION_WIDTH,
    type,
  };
}

export function getDefaultStopSingleSimulation(
  text?: string,
  type: SimulationType = DEFAULT_SIMULATION_TYPE,
  stopType?: StopState,
  stop?: IStopWithAudio,
  language?: string,
  direction?: string
): Simulation {
  const stopAudio = Array.isArray(stop?.stop_audios)
    ? stop?.stop_audios[0]
    : stop?.stop_audios;
  const upLat =
    typeof stop?.up_latitude === "string"
      ? parseFloat(stop.up_latitude)
      : (stop?.up_latitude ?? 0);
  const upLng =
    typeof stop?.up_longitude === "string"
      ? parseFloat(stop.up_longitude)
      : (stop?.up_longitude ?? 0);
  const downLat =
    typeof stop?.down_latitude === "string"
      ? parseFloat(stop.down_latitude)
      : (stop?.down_latitude ?? 0);
  const downLng =
    typeof stop?.down_longitude === "string"
      ? parseFloat(stop.down_longitude)
      : (stop?.down_longitude ?? 0);

  const langMatch = AVAILABLE_LANGUAGES.find((lang) => lang.code === language);

  return {
    format: "single",
    texts: {
      text: getDefaultTextConfig(text),
    },
    height: DEFAULT_SIMULATION_HEIGHT,
    width: DEFAULT_SIMULATION_WIDTH,
    type,
    audioFileUrl: stopAudio?.url || null,
    audioFileName: stopAudio?.file_name || null,
    stopType,
    latitude: direction === "up" ? upLat : downLat,
    longitude: direction === "up" ? upLng : downLng,
    stopTypeAudioFileUrl: stopType && langMatch ? langMatch[stopType] || null : null,
    stopTypeAudioFileName:
      stopType && langMatch ? langMatch[`${stopType}FileName`] || null : null,
  };
}

export function getDefaultTwoSimulation(
  sideText?: string,
  text?: string,
  type: SimulationType = DEFAULT_SIMULATION_TYPE,
  routeNumber1?: string,
  routeNumber2?: string,
  isSplitRoute?: boolean
): Simulation {
  const texts: TwoSimulationTexts = {
    text: getDefaultTextConfig(text),
    ...(isSplitRoute
      ? {
          routeNumber1: getDefaultTextConfig(routeNumber1 || "Route 1"),
          routeNumber2: getDefaultTextConfig(routeNumber2 || "Route 2"),
        }
      : {
          sideText: getDefaultTextConfig(sideText),
        }),
  };

  return {
    format: "two",
    texts,
    height: DEFAULT_SIMULATION_HEIGHT,
    width: DEFAULT_SIMULATION_WIDTH,
    type,
  };
}

export function getDefaultThreeSimulation(
  sideText?: string,
  upperHalfText?: string,
  lowerHalfText?: string,
  type: SimulationType = DEFAULT_SIMULATION_TYPE,
  routeNumber1?: string,
  routeNumber2?: string,
  isSplitRoute?: boolean
): Simulation {
  const texts: ThreeSimulationTexts = {
    upperHalfText: getDefaultTextConfig(upperHalfText),
    lowerHalfText: getDefaultTextConfig(lowerHalfText),
    ...(isSplitRoute
      ? {
          routeNumber1: getDefaultTextConfig(routeNumber1 || "Route 1"),
          routeNumber2: getDefaultTextConfig(routeNumber2 || "Route 2"),
        }
      : {
          sideText: getDefaultTextConfig(sideText),
        }),
  };

  return {
    format: "three",
    texts,
    height: DEFAULT_SIMULATION_HEIGHT,
    width: DEFAULT_SIMULATION_WIDTH,
    type,
  };
}

export const defaultStopRouteConfig: StopRouteConfig = {
  format: "single",
  name: "",
  latitude: 0,
  longitude: 0,
  down_longitude: 0,
  audioFileUrl: null,
  height: DEFAULT_SIMULATION_HEIGHT,
  width: DEFAULT_SIMULATION_WIDTH,
  type: "stop",
  texts: {
    text: getDefaultTextConfig(""),
  },
};

export const defaultDisplayConfigPostRequest: IRouteCreate = {
  route_number: "",
  source: "",
  destination: "",
  via: "",
  route_number_1: "",
  route_number_2: "",
  separation: "-",
  is_split_route: false,
  front: "[]",
  side: "[]",
  rear: "[]",
  internal: "[]",
  stops: "[]",
  version: "2.0",
  depot_id: "",
  organization_id: "",
  return: false,
};

