import axios from "axios";
import { env } from "@/config/env";
import type { BitmapApiParams } from "@/shared/types/bitmap";
import type { Simulation, TextConfig } from "@/shared/types/routeConfigV2";
import { getBitmapColumns } from "@/shared/utils/measurements";

const getInitialBitmapUrl = (): string => {
  // Check if Electron desktop bridge provides a configured backend URL
  if (typeof window !== "undefined" && (window as any).navitronixDesktop?.backendUrl) {
    return (window as any).navitronixDesktop.backendUrl;
  }
  return env.VITE_BITMAP_API_URL;
};

export const BITMAP_API_BASE_URL = getInitialBitmapUrl();

/**
 * Builds the complete URL with search params for the Bitmap API.
 */
export function buildBitmapApiUrl(
  params: BitmapApiParams,
  baseUrl: string = BITMAP_API_BASE_URL
): string {
  const query = new URLSearchParams();

  let textToRender =
    params.text !== undefined && params.text !== null
      ? params.text.toString().trim()
      : "";
  const icon = params.icon ? params.icon.trim() : "";

  if (icon) {
    // If text already has {icon} placeholder, leave it as is
    if (!textToRender.includes("{icon}")) {
      if (!textToRender) {
        textToRender = "{icon}";
      } else {
        const pos = params.iconPosition || "start";
        if (
          params.iconWordIndex !== undefined &&
          params.iconWordIndex !== null &&
          params.iconWordIndex > 0
        ) {
          const words = textToRender.split(" ");
          const idx = Math.min(params.iconWordIndex, words.length);
          words.splice(idx, 0, "{icon}");
          textToRender = words.join(" ");
        } else if (pos === "start") {
          textToRender = `{icon} ${textToRender}`;
        } else if (pos === "end") {
          textToRender = `${textToRender} {icon}`;
        } else if (pos === "center") {
          const words = textToRender.split(" ");
          const mid = Math.ceil(words.length / 2);
          words.splice(mid, 0, "{icon}");
          textToRender = words.join(" ");
        }
      }
    }
    query.append("icon", icon);
    query.append("text", textToRender);
    if (params.iconPosition) {
      query.append("iconPosition", params.iconPosition);
    }
  } else {
    query.append("text", textToRender || " ");
  }

  if (
    params.iconWordIndex !== undefined &&
    params.iconWordIndex !== null &&
    params.iconWordIndex > 0
  ) {
    query.append("iconWordIndex", params.iconWordIndex.toString());
  }

  if (
    params.iconSpacing !== undefined &&
    params.iconSpacing !== null &&
    params.iconSpacing >= 0
  ) {
    query.append("iconSpacing", params.iconSpacing.toString());
  }

  if (
    params.iconWidthScale !== undefined &&
    params.iconWidthScale !== null &&
    params.iconWidthScale > 0
  ) {
    query.append("iconWidthScale", params.iconWidthScale.toString());
  }

  if (params.height !== undefined && params.height !== null) {
    query.append("height", params.height.toString());
  } else if (params.targetRows !== undefined && params.targetRows !== null) {
    query.append("targetRows", params.targetRows.toString());
  }

  if (params.vAlign) {
    query.append("vAlign", params.vAlign);
  }

  if (params.padding !== undefined && params.padding !== null) {
    query.append("padding", params.padding.toString());
  }

  if (params.pleft !== undefined && params.pleft !== null) {
    query.append("pleft", params.pleft.toString());
  }

  if (params.pright !== undefined && params.pright !== null) {
    query.append("pright", params.pright.toString());
  }

  if (
    params.threshold !== undefined &&
    params.threshold !== null &&
    params.threshold > 0
  ) {
    query.append("threshold", params.threshold.toString());
  }

  if (params.family && params.family.trim() !== "") {
    query.append("family", params.family.trim());
  }

  if (params.weight && params.weight.trim() !== "") {
    query.append("weight", params.weight.trim());
  }

  if (params.autoFit !== undefined && params.autoFit !== null) {
    query.append("autoFit", params.autoFit.toString());
  }

  if (
    params.fontSize !== undefined &&
    params.fontSize !== null &&
    params.fontSize > 0
  ) {
    query.append("fontSize", params.fontSize.toString());
  }

  if (
    params.spaceWidth !== undefined &&
    params.spaceWidth !== null &&
    params.spaceWidth > 0
  ) {
    query.append("spaceWidth", params.spaceWidth.toString());
  }

  const queryString = query.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Bitmap API params for one slide text zone.
 */
export function buildZoneBitmapParams(
  zone: Partial<TextConfig> | undefined,
  options: { rows: number; fontFamily?: string; isRouteNumber?: boolean }
): BitmapApiParams {
  const { rows, fontFamily, isRouteNumber } = options;
  const params: BitmapApiParams = {
    text: zone?.text !== undefined && zone?.text !== null ? zone.text : " ",
    icon: zone?.icon || undefined,
    iconPosition: zone?.iconPosition || (zone?.icon ? "start" : undefined),
    iconWordIndex: zone?.iconPosition === "center" ? zone?.iconWordIndex || undefined : undefined,
    iconSpacing: zone?.iconSpacing !== undefined ? zone.iconSpacing : undefined,
    iconWidthScale: zone?.iconWidthScale !== undefined ? zone.iconWidthScale : undefined,
    height: Math.min(zone?.fontHeight || rows, rows),
    weight: zone?.fontWeight === "Bold" ? "Bold" : "Regular",
    family: fontFamily,
    vAlign: zone?.vAlign || undefined,
    threshold: zone?.threshold || undefined,
    spaceWidth: zone?.spaceWidth || undefined,
    autoFit: zone?.autoFit || undefined,
  };

  if (isRouteNumber) {
    params.padding = true;
    params.pleft = zone?.position === "Left" ? 1 : 2;
    params.pright = zone?.position === "Right" ? 1 : 2;
  }

  return params;
}

/**
 * Fetches the multiline ASCII LED bitmap string from the Bitmap API.
 */
export async function fetchBitmapMatrix(
  params: BitmapApiParams,
  baseUrl: string = BITMAP_API_BASE_URL
): Promise<string> {
  const url = buildBitmapApiUrl(params, baseUrl);
  const response = await axios.get<string>(url, {
    responseType: "text",
  });
  return response.data;
}

type FontFamilyResolver = (language: string, zoneKey: string, fontHeight?: number) => string;

const getSlideZoneLayout = (slide: Simulation, isSplitRoute: boolean) => {
  const height = slide.height || 16;
  if (slide.format === "single") return [{ key: "text", rows: height, isRouteNumber: false }];
  const zones = isSplitRoute
    ? [
        { key: "routeNumber1", rows: height / 2, isRouteNumber: true },
        { key: "routeNumber2", rows: height / 2, isRouteNumber: true },
      ]
    : [{ key: "sideText", rows: height, isRouteNumber: true }];
  if (slide.format === "two") {
    zones.push({ key: "text", rows: height, isRouteNumber: false });
  } else {
    zones.push(
      { key: "upperHalfText", rows: height / 2, isRouteNumber: false },
      { key: "lowerHalfText", rows: height / 2, isRouteNumber: false }
    );
  }
  return zones;
};

/**
 * Generates bitmaps for slide zones that have none yet.
 */
export async function fillMissingSlideBitmaps(
  slides: Simulation[],
  options: { isSplitRoute: boolean; getFontFamily: FontFamilyResolver; concurrency?: number }
): Promise<{ slides: Simulation[]; failed: number }> {
  if (!Array.isArray(slides) || slides.length === 0) return { slides, failed: 0 };
  const { isSplitRoute, getFontFamily, concurrency = 6 } = options;

  const jobs: { slideIndex: number; key: string; params: BitmapApiParams }[] = [];
  slides.forEach((slide, slideIndex) => {
    if (!slide || !slide.texts) return;
    const texts = slide.texts as Record<string, TextConfig | undefined>;
    getSlideZoneLayout(slide, isSplitRoute).forEach(({ key, rows, isRouteNumber }) => {
      const zone = texts[key];
      if (!zone || (zone.bitmap && zone.bitmap.trim().length > 0)) return;
      const fontFamily = getFontFamily(zone.language || "en", key, zone.fontHeight);
      jobs.push({ slideIndex, key, params: buildZoneBitmapParams(zone, { rows, fontFamily, isRouteNumber }) });
    });
  });
  if (jobs.length === 0) return { slides, failed: 0 };

  const results = new Map<string, string>();
  let failed = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      try {
        const bitmap = await fetchBitmapMatrix(job.params);
        if (typeof bitmap === "string" && bitmap.trim().length > 0) {
          results.set(`${job.slideIndex}.${job.key}`, bitmap);
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));

  const filled = slides.map((slide, slideIndex) => {
    if (!slide || !slide.texts) return slide;
    let texts: Record<string, TextConfig | undefined> | null = null;
    for (const key of Object.keys(slide.texts)) {
      const bitmap = results.get(`${slideIndex}.${key}`);
      if (!bitmap) continue;
      texts = texts || { ...(slide.texts as Record<string, TextConfig | undefined>) };
      texts[key] = { ...(texts[key] as TextConfig), bitmap, fontWidth: getBitmapColumns(bitmap) };
    }
    return texts ? ({ ...slide, texts } as Simulation) : slide;
  });

  return { slides: filled, failed };
}

