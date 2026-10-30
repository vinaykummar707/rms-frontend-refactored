export const V1ScrollTypes = [
  "Left To Right",
  "Right To Left",
  "Fixed",
  "Flashing",
] as const;
export type V1ScrollType = (typeof V1ScrollTypes)[number];

export const V1Positions = ["Left", "Right", "Center"] as const;
export type V1Position = (typeof V1Positions)[number];

export const V1ScreenFormats = ["single", "two", "three"] as const;
export type V1ScreenFormat = (typeof V1ScreenFormats)[number];

export const V1FontWeights = ["Regular", "Bold"] as const;
export type V1FontWeight = (typeof V1FontWeights)[number];

export const DEFAULT_V1_SCREEN_HEIGHTS = [16, 32] as const;
export type V1ScreenHeight = (typeof DEFAULT_V1_SCREEN_HEIGHTS)[number];

export const DEFAULT_V1_SCREEN_WIDTHS = [64, 96, 128, 160, 192, 224] as const;
export type V1ScreenWidth = (typeof DEFAULT_V1_SCREEN_WIDTHS)[number];

export const V1_SCROLL_SPEED_PRESETS = [
  { label: "Very Fast", value: 5 },
  { label: "Medium Fast", value: 4 },
  { label: "Normal", value: 3 },
  { label: "Slow", value: 2 },
  { label: "Very Slow", value: 1 },
] as const;

export interface V1TextConfig {
  text: string;
  bitmap?: string;
  fontWidth?: number;
  scrollType: V1ScrollType;
  position: V1Position;
  scrollSpeed: number;
  fontWeight: V1FontWeight;
  fontHeight?: number;
  fontSize?: number;
  language?: string;
}

export interface V1Screen {
  format: V1ScreenFormat;
  texts: Record<string, V1TextConfig>;
  height: V1ScreenHeight;
  width: V1ScreenWidth;
}

export interface V1Screens {
  front: V1Screen;
  side: V1Screen;
  rear: V1Screen;
  internal: V1Screen;
}

export interface RouteInformation {
  routeNumber: string;
  source: string;
  destination: string;
  via: string;
  routeNumber1: string;
  routeNumber2: string;
  separation: string;
  splitRoute: boolean;
  showRt: boolean;
  showSpm: boolean;
  showBoth: boolean;
  specialMessage?: boolean;
}

export interface SpecialMessage {
  title: string;
  message: string;
  priority?: number;
}

export interface LanguageDisplayConfig {
  [languageCode: string]: V1Screens;
}

export interface DisplayConfig {
  route: RouteInformation;
  displayConfig: LanguageDisplayConfig;
  version: string;
  areaId: string;
  depotId: string;
  createdAt?: string;
  active?: boolean | string;
  deleted?: boolean | string;
  id?: string;
  specialMessages: SpecialMessage[];
}

export const defaultRoute: RouteInformation = {
  routeNumber: "",
  source: "",
  destination: "",
  via: "",
  splitRoute: false,
  routeNumber1: "",
  routeNumber2: "",
  separation: "-",
  showRt: true,
  showSpm: false,
  showBoth: false,
};

export const getDefaultV1TextConfig = (): V1TextConfig => ({
  text: "",
  bitmap: "",
  fontWidth: 12,
  scrollType: "Fixed",
  position: "Center",
  scrollSpeed: 1,
  fontWeight: "Regular",
  fontHeight: 12,
});

export const defaultV1Values: DisplayConfig = {
  route: defaultRoute,
  displayConfig: {},
  version: "1.0",
  areaId: "",
  depotId: "",
  specialMessages: [],
};

