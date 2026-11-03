import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import LEDMatrix from "./CanvasText";
import { buildBitmapApiUrl, buildZoneBitmapParams } from "@/features/bitmap/services/bitmapService";

const bitmapMemoryCache = new Map<string, string>();

function convertAsciiToArray(ascii?: string): string[] {
  if (!ascii || typeof ascii !== "string") return [];
  return ascii
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function convertScrollTypeToMarqueeDirection(scrollType: any) {
  switch (scrollType) {
    case "Left To Right":
      return "ltr";
    case "Right To Left":
      return "rtl";
    case "Fixed":
      return "none";
    default:
      return "none";
  }
}

function convertPositionToAlignment(position: any) {
  switch (position) {
    case "Left":
      return "start";
    case "Right":
      return "end";
    case "Center":
      return "center";
    default:
      return "center";
  }
}

interface LEDBitmapSimulatorProps {
  text: any;
  rows: number;
  fontFamily?: string;
  cols: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  stopScroll?: boolean;
  onBitmapTextChange?: (bitmapText: string) => void;
  isRouteNumber?: boolean;
  ledColor?: string;
}

export const LEDBitmapSimulator: React.FC<LEDBitmapSimulatorProps> = ({
  text,
  rows,
  fontFamily,
  cols,
  horizontalSpacing: _horizontalSpacing = 9,
  verticalSpacing: _verticalSpacing = 9,
  stopScroll,
  onBitmapTextChange,
  isRouteNumber = false,
  ledColor = "#ffbf00",
}) => {
  const safeText = text || {
    text: "",
    fontHeight: 12,
    fontWeight: "Regular",
    scrollType: "Fixed",
    position: "Center",
    scrollSpeed: 1,
    fontSize: 12,
  };

  const [bitmapText, setBitmapText] = useState(safeText?.bitmap || "");

  const getApiUrl = () =>
    buildBitmapApiUrl(buildZoneBitmapParams(safeText, { rows, fontFamily, isRouteNumber }));

  const apiUrl = getApiUrl();
  const isBlankText = !String(safeText?.text ?? "").trim() && !safeText?.icon;
  const mountApiUrlRef = useRef(apiUrl);
  const storedBitmap =
    !isBlankText && apiUrl === mountApiUrlRef.current && safeText?.bitmap && safeText.bitmap.trim().length > 0
      ? safeText.bitmap
      : "";
  const currentBitmapText = isBlankText
    ? ""
    : storedBitmap || bitmapMemoryCache.get(apiUrl) || bitmapText;

  const pattern = useMemo(() => {
    return convertAsciiToArray(currentBitmapText);
  }, [currentBitmapText]);

  useEffect(() => {
    const controller = new AbortController();

    if (storedBitmap) {
      bitmapMemoryCache.set(apiUrl, storedBitmap);
    }

    if (currentBitmapText && currentBitmapText !== bitmapText) {
      setBitmapText(currentBitmapText);
    }
    if (isBlankText && bitmapText) {
      setBitmapText("");
    }

    const fetchBitmap = async () => {
      try {
        const response = await axios.get(apiUrl, { signal: controller.signal });
        if (response.data) {
          bitmapMemoryCache.set(apiUrl, response.data);
          if (response.data !== currentBitmapText) {
            setBitmapText(response.data);
          }
        }
      } catch (error: any) {
        if (axios.isCancel(error) || error?.name === "CanceledError" || error?.name === "AbortError") {
          return;
        }
      }
    };

    if (!isBlankText && !storedBitmap && !bitmapMemoryCache.has(apiUrl)) {
      const timer = setTimeout(() => {
        fetchBitmap();
      }, 50);
      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }

    return () => {
      controller.abort();
    };
  }, [
    apiUrl,
    safeText?.bitmap,
    safeText?.scrollType,
    safeText?.position,
    safeText?.scrollSpeed,
    safeText?.fontSize,
    safeText?.fontWeight,
    safeText?.fontHeight,
    stopScroll,
  ]);

  useEffect(() => {
    if (!onBitmapTextChange) return;
    if (isBlankText) {
      if (safeText?.bitmap) onBitmapTextChange("");
      return;
    }
    if (currentBitmapText && currentBitmapText !== safeText?.bitmap) {
      onBitmapTextChange(currentBitmapText);
    }
  }, [currentBitmapText, safeText?.bitmap, onBitmapTextChange, isBlankText]);

  return (
    <div className="flex flex-col">
      <LEDMatrix
        rows={rows}
        columns={cols}
        pattern={pattern}
        marqueeDirection={convertScrollTypeToMarqueeDirection(safeText.scrollType)}
        scrollSpeed={parseInt(String(safeText.scrollSpeed || 1), 10)}
        alignment={convertPositionToAlignment(safeText.position)}
        paused={stopScroll}
        onColor={ledColor}
      />
    </div>
  );
};

export default LEDBitmapSimulator;
