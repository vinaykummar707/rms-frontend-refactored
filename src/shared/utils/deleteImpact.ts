import { supabase } from "@/integrations/supabase/client";

const countActive = async (
  table: string,
  column: string,
  values: string[]
): Promise<number> => {
  if (values.length === 0) return 0;
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in(column, values)
    .eq("deleted", false);

  if (error) {
    console.warn(`Failed to count ${table} for delete warning:`, error);
    return 0;
  }
  return count ?? 0;
};

const confirmWithImpact = (item: string, counts: [number, string][]): boolean => {
  const summary = counts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}${n === 1 ? "" : "s"}`)
    .join(", ");

  return confirm(
    summary
      ? `Deleting this ${item} may also delete its associated routes and data (${summary}). This action cannot be undone.\n\nDo you want to continue?`
      : `Are you sure you want to delete this ${item}? This action cannot be undone.`
  );
};

export async function getRegionDeleteImpactMessage(regionId: string): Promise<string> {
  const { data } = await supabase
    .from("depots")
    .select("id")
    .eq("region_id", regionId);
  const depotIds = (data ?? []).map((d: { id: string }) => d.id);
  const [routes, stops, users] = await Promise.all([
    countActive("routes", "depot_id", depotIds),
    countActive("stops", "depot_id", depotIds),
    countActive("users", "region_id", [regionId]),
  ]);
  const counts: [number, string][] = [
    [depotIds.length, "depot"],
    [routes, "route"],
    [stops, "stop"],
    [users, "user"],
  ];
  const summary = counts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}${n === 1 ? "" : "s"}`)
    .join(", ");
  return summary
    ? `Deleting this region will also affect its associated ${summary}. This action cannot be undone.`
    : `Are you sure you want to delete this region? This action cannot be undone.`;
}

export async function getDepotDeleteImpactMessage(depotId: string): Promise<string> {
  const [routes, stops, users] = await Promise.all([
    countActive("routes", "depot_id", [depotId]),
    countActive("stops", "depot_id", [depotId]),
    countActive("users", "depot_id", [depotId]),
  ]);
  const counts: [number, string][] = [
    [routes, "route"],
    [stops, "stop"],
    [users, "user"],
  ];
  const summary = counts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}${n === 1 ? "" : "s"}`)
    .join(", ");
  return summary
    ? `Deleting this depot will also affect its associated ${summary}. This action cannot be undone.`
    : `Are you sure you want to delete this depot? This action cannot be undone.`;
}

export async function confirmRegionDelete(regionId: string): Promise<boolean> {
  const { data } = await supabase
    .from("depots")
    .select("id")
    .eq("region_id", regionId)
    .eq("deleted", false);
  const depotIds = (data ?? []).map((d: { id: string }) => d.id);
  const [routes, stops, users] = await Promise.all([
    countActive("routes", "depot_id", depotIds),
    countActive("stops", "depot_id", depotIds),
    countActive("users", "region_id", [regionId]),
  ]);
  return confirmWithImpact("region", [
    [depotIds.length, "depot"],
    [routes, "route"],
    [stops, "stop"],
    [users, "user"],
  ]);
}

export async function confirmDepotDelete(depotId: string): Promise<boolean> {
  const [routes, stops, users] = await Promise.all([
    countActive("routes", "depot_id", [depotId]),
    countActive("stops", "depot_id", [depotId]),
    countActive("users", "depot_id", [depotId]),
  ]);
  return confirmWithImpact("depot", [
    [routes, "route"],
    [stops, "stop"],
    [users, "user"],
  ]);
}

export async function confirmUserDelete(authUserId?: string | null): Promise<boolean> {
  const routes = authUserId ? await countActive("routes", "created_by", [authUserId]) : 0;
  return confirmWithImpact("user", [[routes, "route"]]);
}

