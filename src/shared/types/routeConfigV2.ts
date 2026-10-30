export const stopStates = ["current", "next", "coming"] as const;
export type StopState = (typeof stopStates)[number];

export const SCROLL_TYPES = ["Left To Right", "Right To Left", "Fixed"] as const;
export type ScrollType = (typeof SCROLL_TYPES)[number];

export const POSITIONS = ["Left", "Right", "Center"] as const;
export type Position = (typeof POSITIONS)[number];

export const SIMULATION_FORMATS = ["single", "two", "three"] as const;
export type SimulationFormat = (typeof SIMULATION_FORMATS)[number];

export const SIMULATION_TYPES = [
  "route",
  "special message",
  "slogan",
  "stop",
] as const;
export type SimulationType = (typeof SIMULATION_TYPES)[number];

export const FONT_WEIGHTS = ["Regular", "Bold"] as const;
export type FontWeight = (typeof FONT_WEIGHTS)[number];

export const DEFAULT_SIMULATION_HEIGHTS = [16, 32] as const;
export type SimulationHeight = (typeof DEFAULT_SIMULATION_HEIGHTS)[number];

export const DEFAULT_SIMULATION_WIDTHS = [64, 96, 128, 160, 192, 224] as const;
export type SimulationWidth = (typeof DEFAULT_SIMULATION_WIDTHS)[number];

export const SCROLL_SPEED_PRESETS = [
  { label: "Very Fast", value: 9 },
  { label: "Medium Fast", value: 6 },
  { label: "Normal", value: 4 },
  { label: "Slow", value: 3 },
  { label: "Very Slow", value: 1 },
] as const;

export type ScrollSpeedPresetLabel = (typeof SCROLL_SPEED_PRESETS)[number]["label"];
export type ScrollSpeedPresetValue = (typeof SCROLL_SPEED_PRESETS)[number]["value"];

export interface BitmapTranslations {
  bitmap: string;
  width: number;
  height: number;
}

export interface TextConfig {
  text: string;
  bitmap?: string;
  fontWidth?: number;
  scrollType: ScrollType;
  position: Position;
  scrollSpeed: number;
  fontWeight: FontWeight;
  fontHeight?: number;
  language: string;
  icon?: string;
  iconPosition?: "start" | "end" | "center";
  iconWordIndex?: number;
  iconSpacing?: number;
  iconWidthScale?: number;
  vAlign?: "Center" | "Top" | "Bottom";
  padding?: boolean;
  pleft?: number;
  pright?: number;
  threshold?: number;
  autoFit?: boolean;
  fontSize?: number;
  spaceWidth?: number;
}

export type SimulationTextKey =
  | "sideText"
  | "upperHalfText"
  | "lowerHalfText"
  | "text"
  | "routeNumber1"
  | "routeNumber2";

export type SingleSimulationTexts = {
  text: TextConfig;
};

export type TwoSimulationTexts = {
  text: TextConfig;
  sideText?: TextConfig;
  routeNumber1?: TextConfig;
  routeNumber2?: TextConfig;
};

export type ThreeSimulationTexts = {
  upperHalfText: TextConfig;
  lowerHalfText: TextConfig;
  sideText?: TextConfig;
  routeNumber1?: TextConfig;
  routeNumber2?: TextConfig;
};

export interface Simulation {
  format: SimulationFormat;
  texts: SingleSimulationTexts | TwoSimulationTexts | ThreeSimulationTexts;
  height: SimulationHeight;
  width: SimulationWidth;
  type: SimulationType;
  latitude?: number;
  longitude?: number;
  audioFileUrl?: string | null;
  audioFileName?: string | null;
  stopType?: StopState;
  stopTypeAudioFileUrl?: string | null;
  stopTypeAudioFileName?: string | null;
}

export type Screen = Simulation;

export interface StopRouteConfig extends Simulation {
  name: string;
  latitude: number;
  longitude: number;
  down_longitude: number;
}

export interface DisplayConfigPostRequest {
  route_number: string;
  source: string;
  destination: string;
  via: string;
  route_number_1: string;
  route_number_2: string;
  separation: string;
  is_split_route: boolean;
  front: Simulation[];
  side: Simulation[];
  rear: Simulation[];
  internal: Simulation[];
  stops?: Simulation[];
  version: string;
  depot_id: string;
  organization_id: string;
  return: boolean;
}

export interface DisplayConfigGetRequest extends DisplayConfigPostRequest {
  id: string;
  created_at: string;
}

