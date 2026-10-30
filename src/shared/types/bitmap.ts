export interface BitmapApiParams {
  text?: string;
  icon?: string;
  iconPosition?: "start" | "end" | "center";
  iconWordIndex?: number;
  iconSpacing?: number;
  iconWidthScale?: number;
  targetRows?: number;
  height?: number;
  vAlign?: "Center" | "Top" | "Bottom";
  padding?: boolean;
  pleft?: number;
  pright?: number;
  threshold?: number;
  family?: string;
  weight?: "Regular" | "Bold" | "";
  autoFit?: boolean;
  fontSize?: number;
  spaceWidth?: number;
}

