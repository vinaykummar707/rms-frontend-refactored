import type { DisplayConfig } from "@/shared/types/v1RouteTypes";
import type { IRouteCreate } from "@/shared/types/route";

/**
 * Determines the primary language code of a simulation screen object.
 */
function getScreenLanguage(screen: any): string {
  const texts = screen?.texts || {};
  for (const key of ["sideText", "upperHalfText", "lowerHalfText", "text"]) {
    if (texts[key]?.language) {
      return texts[key].language;
    }
  }
  for (const key in texts) {
    if (texts[key]?.language) {
      return texts[key].language;
    }
  }
  return "en";
}

/**
 * Safely parses field value if it's stringified JSON or returns object directly.
 */
function parseSection(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Converts a single V2 or Supabase route configuration object into a V1 DisplayConfig object.
 */
export function convertV2ToV1(v2Route: any): DisplayConfig {
  if (!v2Route) return v2Route;

  // 1. Map nested route metadata object
  const route = {
    routeNumber: v2Route.route_number || v2Route.routeNumber || "",
    source: v2Route.source || "",
    destination: v2Route.destination || "",
    via: v2Route.via || "",
    splitRoute: Boolean(v2Route.is_split_route ?? v2Route.splitRoute ?? false),
    routeNumber1: v2Route.route_number_1 || v2Route.routeNumber1 || "",
    routeNumber2: v2Route.route_number_2 || v2Route.routeNumber2 || "",
    separation:
      v2Route.separation !== undefined && v2Route.separation !== ""
        ? v2Route.separation
        : "-",
    specialMessage: Boolean(v2Route.special_message ?? v2Route.specialMessage ?? false),
    showRt: Boolean(v2Route.show_rt ?? v2Route.showRt ?? true),
    showSpm: Boolean(v2Route.show_spm ?? v2Route.showSpm ?? false),
    showBoth: Boolean(v2Route.show_both ?? v2Route.showBoth ?? false),
  };

  // 2. Map displayConfig grouped by language code
  const displayLocations = ["front", "side", "rear", "internal"] as const;
  const languageDisplayConfig: Record<string, any> = {};

  for (const loc of displayLocations) {
    const rawScreens = v2Route[loc];
    const screensArray = parseSection(rawScreens);

    for (const screen of screensArray) {
      const lang = getScreenLanguage(screen);
      if (!languageDisplayConfig[lang]) {
        languageDisplayConfig[lang] = {};
      }

      const cleanTexts: Record<string, any> = {};
      const rawTexts = screen.texts || {};

      for (const tKey in rawTexts) {
        const tVal = rawTexts[tKey];
        if (tVal && typeof tVal === "object") {
          cleanTexts[tKey] = {
            text: tVal.text ?? "",
            bitmap: tVal.bitmap ?? "",
            fontWidth: tVal.fontWidth ?? 0,
            scrollType: tVal.scrollType ?? "Fixed",
            position: tVal.position ?? "Center",
            scrollSpeed: tVal.scrollSpeed ?? 1,
            fontWeight: tVal.fontWeight ?? "Bold",
            fontHeight: tVal.fontHeight ?? 8,
          };
        }
      }

      const screenConfig = {
        format: screen.format || "single",
        texts: cleanTexts,
        height: screen.height ?? 16,
        width: screen.width ?? 96,
      };

      if (!languageDisplayConfig[lang][loc]) {
        languageDisplayConfig[lang][loc] = {
          ...screenConfig,
          screens: [screenConfig],
        };
      } else {
        if (!Array.isArray(languageDisplayConfig[lang][loc].screens)) {
          languageDisplayConfig[lang][loc].screens = [
            {
              format: languageDisplayConfig[lang][loc].format,
              texts: languageDisplayConfig[lang][loc].texts,
              height: languageDisplayConfig[lang][loc].height,
              width: languageDisplayConfig[lang][loc].width,
            },
          ];
        }
        languageDisplayConfig[lang][loc].screens.push(screenConfig);
      }
    }
  }

  // 3. Assemble V1 structure
  const v1Config: DisplayConfig = {
    id: v2Route.id,
    route,
    displayConfig: languageDisplayConfig,
    specialMessages: v2Route.specialMessages || [],
    version: "1.0",
    areaId: v2Route.organization_id || v2Route.areaId || "",
    depotId: v2Route.depot_id || v2Route.depotId || "",
    active: v2Route.active ?? true,
    createdAt: v2Route.created_at || v2Route.createdAt || new Date().toISOString(),
  };

  return v1Config;
}

/**
 * Converts a V1 DisplayConfig object into a Supabase IRouteCreate payload.
 */
export function convertV1ToDbRoute(
  v1Config: DisplayConfig,
  options?: {
    userId?: string;
    organizationId?: string;
    depotId?: string;
  }
): IRouteCreate {
  const route = v1Config.route || ({} as any);
  const displayLocations = ["front", "side", "rear", "internal"] as const;
  const boardData: Record<string, string> = {};

  for (const loc of displayLocations) {
    const screens: any[] = [];
    for (const [lang, boards] of Object.entries(v1Config.displayConfig || {})) {
      const screen = (boards as any)?.[loc];
      if (screen) {
        const cleanTexts: Record<string, any> = {};
        for (const [tKey, tVal] of Object.entries(screen.texts || {})) {
          if (tVal && typeof tVal === "object") {
            cleanTexts[tKey] = {
              ...(tVal as any),
              language: lang,
            };
          }
        }
        screens.push({
          format: screen.format || "single",
          height: screen.height ?? 16,
          width: screen.width ?? 96,
          texts: cleanTexts,
        });
      }
    }
    boardData[loc] = JSON.stringify(screens);
  }

  const routeNumber = route.splitRoute
    ? `${route.routeNumber1 || ""}${route.separation || "-"}${route.routeNumber2 || ""}`
    : route.routeNumber || "";

  const payload: any = {
    route_number: routeNumber,
    route_number_1: route.routeNumber1 || "",
    route_number_2: route.routeNumber2 || "",
    is_split_route: Boolean(route.splitRoute),
    source: route.source || "",
    destination: route.destination || "",
    via: route.via || "",
    separation:
      route.separation !== undefined && route.separation !== ""
        ? route.separation
        : "-",
    version: "1.0",
    front: boardData.front || "[]",
    side: boardData.side || "[]",
    rear: boardData.rear || "[]",
    internal: boardData.internal || "[]",
    stops: "[]",
    return: false,
  };

  const orgId = options?.organizationId || v1Config.areaId;
  if (orgId && typeof orgId === "string" && orgId.trim() !== "") {
    payload.organization_id = orgId.trim();
  }

  const depotId = options?.depotId || v1Config.depotId;
  if (depotId && typeof depotId === "string" && depotId.trim() !== "") {
    payload.depot_id = depotId.trim();
  }

  if (v1Config.id && typeof v1Config.id === "string" && v1Config.id.trim() !== "") {
    payload.id = v1Config.id.trim();
  }

  if (options?.userId && typeof options.userId === "string" && options.userId.trim() !== "") {
    payload.created_by = options.userId.trim();
  }

  return payload;
}

