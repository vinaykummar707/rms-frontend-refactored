import { supabase } from "@/integrations/supabase/client";
import { checkActiveDuplicate } from "@/shared/hooks/useCrud";
import { convertV2ToV1 } from "@/shared/utils/routeConfigMapper";
import {
  exportRoutesInBatches,
  getExportErrorMessage,
  writeZipToDirectoryOrFallback,
} from "@/shared/utils/fileSystemExport";
import { env } from "@/config/env";
import axios from "axios";
import type { IRoute, IRouteCreate } from "@/shared/types/route";

export async function checkRouteNumberDuplicate(
  routeNumber: string,
  depotId: string,
  excludeId?: string
): Promise<boolean> {
  return checkActiveDuplicate(
    "routes",
    "route_number",
    routeNumber,
    { depot_id: depotId },
    excludeId
  );
}

/**
 * Creates a Return route from an existing route:
 * - Swaps source and destination
 * - Reverses the stops array
 * - Appends "R" or "-R" to the route number
 * - Swaps source and destination strings inside the signboard config
 * - Sets return: true
 */
export async function createReturnRoute(
  routeId: string,
  routeNumberSuffix: string = "R",
  userId?: string
): Promise<IRoute> {
  const { data: originalRoute, error: fetchError } = await supabase
    .from("routes")
    .select("*")
    .eq("id", routeId)
    .single();

  if (fetchError || !originalRoute) {
    throw new Error(`Failed to fetch original route: ${fetchError?.message || "Route not found"}`);
  }

  const { id: _unusedId, ...routeWithoutId } = originalRoute;

  // 1. Reverse stops
  let reversedStops = originalRoute.stops;
  if (originalRoute.stops) {
    try {
      const parsed =
        typeof originalRoute.stops === "string"
          ? JSON.parse(originalRoute.stops)
          : originalRoute.stops;
      if (Array.isArray(parsed)) {
        reversedStops = JSON.stringify([...parsed].reverse());
      }
    } catch (err) {
      console.error("Error reversing stops for return route:", err);
    }
  }

  // 2. Format return route number
  const suffix = routeNumberSuffix === "(Return)" ? "R" : routeNumberSuffix;
  const newRouteNumber = originalRoute.route_number?.endsWith("R")
    ? `${originalRoute.route_number}-R`
    : `${originalRoute.route_number}${suffix}`;

  // 3. Swap source and destination in config
  let swappedConfig = originalRoute.config;
  if (originalRoute.config) {
    try {
      let configStr =
        typeof originalRoute.config === "string"
          ? originalRoute.config
          : JSON.stringify(originalRoute.config);
      const oldSrc = (originalRoute.source || "").trim();
      const oldDest = (originalRoute.destination || "").trim();
      if (oldSrc && oldDest && oldSrc !== oldDest) {
        const PLACEHOLDER = "___TMP_SWAP_SRC_DEST___";
        configStr = configStr
          .split(oldSrc)
          .join(PLACEHOLDER)
          .split(oldDest)
          .join(oldSrc)
          .split(PLACEHOLDER)
          .join(oldDest);
        swappedConfig =
          typeof originalRoute.config === "string"
            ? configStr
            : JSON.parse(configStr);
      }
    } catch (err) {
      console.error("Error swapping source/destination in return route config:", err);
    }
  }

  const payload: IRouteCreate = {
    ...routeWithoutId,
    source: originalRoute.destination || originalRoute.source,
    destination: originalRoute.source || originalRoute.destination,
    stops: reversedStops,
    config: swappedConfig,
    route_number: newRouteNumber,
    created_at: new Date().toISOString(),
    return: true,
    created_by: userId || originalRoute.created_by || "",
  };

  const { data: createdRoute, error: insertError } = await supabase
    .from("routes")
    .insert(payload)
    .select()
    .single();

  if (insertError || !createdRoute) {
    throw new Error(`Failed to create return route: ${insertError?.message || "Unknown error"}`);
  }

  return createdRoute as IRoute;
}

/**
 * Duplicates a route with duplicate route number collision resolution
 */
export async function duplicateRoute(
  routeId: string,
  routeNumberSuffix: string = "D",
  userId?: string
): Promise<IRoute> {
  const { data: originalRoute, error: fetchError } = await supabase
    .from("routes")
    .select("*")
    .eq("id", routeId)
    .single();

  if (fetchError || !originalRoute) {
    throw new Error(`Failed to fetch route to duplicate: ${fetchError?.message || "Route not found"}`);
  }

  const { id: _unusedId, ...routeWithoutId } = originalRoute;
  const baseNumber = (originalRoute.route_number || "").trim();
  const suffix = routeNumberSuffix === " (Copy)" ? "D" : routeNumberSuffix || "D";
  let candidateNumber = `${baseNumber}${suffix}`;

  if (originalRoute.depot_id) {
    const { data: existing } = await supabase
      .from("routes")
      .select("id")
      .eq("depot_id", originalRoute.depot_id)
      .ilike("route_number", candidateNumber)
      .maybeSingle();

    if (existing) {
      candidateNumber = `${baseNumber}${suffix}1`;
    }
  }

  const payload: IRouteCreate = {
    ...routeWithoutId,
    route_number: candidateNumber,
    created_at: new Date().toISOString(),
    created_by: userId || originalRoute.created_by || "",
  };

  const { data: createdRoute, error: insertError } = await supabase
    .from("routes")
    .insert(payload)
    .select()
    .single();

  if (insertError || !createdRoute) {
    throw new Error(`Failed to duplicate route: ${insertError?.message || "Unknown error"}`);
  }

  return createdRoute as IRoute;
}

/**
 * Parses JSON field value safely
 */
export function parseRouteSignboardField(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

/**
 * Exports routes to the controller API in batches of 10 and triggers zip download.
 */
export async function exportRoutes(
  routes: IRoute[],
  format: "v1" | "v2",
  scope?: { organizationId?: string; depotId?: string }
): Promise<void> {
  if (!routes.length) {
    throw new Error("No routes provided for export");
  }

  const rawRoutes = routes.map((r) => ({
    ...r,
    front: parseRouteSignboardField(r.front),
    side: parseRouteSignboardField(r.side),
    rear: parseRouteSignboardField(r.rear),
    internal: parseRouteSignboardField(r.internal),
    stops: parseRouteSignboardField(r.stops),
  }));

  const currentDate = new Date().toISOString().split("T")[0];
  const apiBase = env.VITE_CONTROLLER_API_URL;
  const areaId = scope?.organizationId || routes[0]?.organization_id || "";
  const depotId = scope?.depotId || routes[0]?.depot_id || "";

  if (format === "v1") {
    const v1RoutesPayload = rawRoutes.map((route) => convertV2ToV1(route));
    const exportUrl = `${apiBase}/routes/export?areaId=${areaId}&depotId=${depotId}`;

    try {
      const blob = await exportRoutesInBatches(v1RoutesPayload, async (batch) => {
        const response = await axios.post(exportUrl, batch, {
          headers: { "Content-Type": "application/json" },
          responseType: "blob",
        });
        return new Blob([response.data], { type: "application/zip" });
      });

      await writeZipToDirectoryOrFallback(blob, `routes_export_v1_${currentDate}.zip`);
    } catch (error: any) {
      const msg = await getExportErrorMessage(error);
      throw new Error(`V1 export failed: ${msg}`);
    }
  } else {
    const exportUrl = `${apiBase}/routes/export-v2?areaId=${areaId}&depotId=${depotId}`;

    try {
      const blob = await exportRoutesInBatches(rawRoutes, async (batch) => {
        const response = await axios.post(exportUrl, batch, {
          headers: { "Content-Type": "application/json" },
          responseType: "blob",
        });
        return new Blob([response.data], { type: "application/zip" });
      });

      await writeZipToDirectoryOrFallback(blob, `routes_export_v2_${currentDate}.zip`);
    } catch (error: any) {
      const msg = await getExportErrorMessage(error);
      throw new Error(`V2 export failed: ${msg}`);
    }
  }
}

