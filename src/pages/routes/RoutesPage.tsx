import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { cn } from "cn";
import { useOrganizationStore } from "@/features/stores/useOrganizationStore";
import { useRegionStore } from "@/features/stores/useRegionStore";
import { useDepotStore } from "@/features/stores/useDepotStore";
import { useAuthStore } from "@/core/auth/authStore";
import { useAuthorization } from "@/core/authorization/useAuthorization";
import { regionCrud } from "@/features/regions/api/regionCrud";
import { depotCrud } from "@/features/depots/api/depotCrud";
import { routeCrud } from "@/features/routes/api/routeCrud";
import {
  createReturnRoute,
  duplicateRoute,
  exportRoutes,
} from "@/features/routes/services/routeService";
import { sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import type { IRegion } from "@/shared/types/region";
import type { IDepot } from "@/shared/types/depot";
import type { IRoute } from "@/shared/types/route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RouteTable } from "./components/RouteTable";
import { MixedVersionExportDialog } from "./components/MixedVersionExportDialog";
import {
  WifiTransferStatusBadge,
  WifiTransferDialog,
  useWifiTransferStore,
} from "@/features/wifiTransfer";
import {
  Route as RouteIcon,
  Plus,
  RefreshCw,
  Download,
  Trash2,
  Warehouse,
  Building2,
  Box,
  AlertTriangle,
  Loader2,
  X,
  MapIcon,
} from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";

export function RoutesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Stores and Auth Context
  const user = useAuthStore((state) => state.user);
  const { selectedOrganization } = useOrganizationStore();
  const selectedRegion = useRegionStore(
    (state) => state.routesPageRegion ?? state.selectedRegion
  );
  const setRoutesPageRegion = useRegionStore((state) => state.setRoutesPageRegion);

  const selectedDepot = useDepotStore(
    (state) => state.routesPageDepot ?? state.selectedDepot
  );
  const setRoutesPageDepot = useDepotStore((state) => state.setRoutesPageDepot);

  const {
    routeAccess,
    isRegularCustomer: isRegular,
    isSuperAdmin: isSuper,
  } = useAuthorization();

  const activeOrgId =
    selectedOrganization?.id || user?.organization_id || user?.organization?.id;
  const activeOrgName =
    selectedOrganization?.name || user?.organization?.name || "Organization";

  const userRole = user?.role?.name?.toLowerCase() || "";
  const isRegionOrDepotAdmin =
    userRole === "region_admin" || userRole === "depot_admin";
  const isDepotAdmin = userRole === "depot_admin";
  const isGuest = userRole === "guest";
  const canManage =
    userRole === "region_admin" ||
    userRole === "organization_admin" ||
    userRole === "master" ||
    userRole === "depot_admin";

  // URL Deep Linking params
  const highlightRouteId =
    searchParams.get("highlightRouteId") || searchParams.get("routeId");

  // Local Component States
  const [searchTerm, setSearchTerm] = useState("");
  const [versionFilter, setVersionFilter] = useState<"all" | "v1" | "v2">("all");
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Dialog States
  const [deletingRoute, setDeletingRoute] = useState<IRoute | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isMixedVersionDialogOpen, setIsMixedVersionDialogOpen] = useState(false);

  // Auto-open route creator for regular customer if routed with ?create=true
  useEffect(() => {
    if (isRegular && searchParams.get("create") === "true") {
      setSearchParams({}, { replace: true });
      if (routeAccess.isV1Only) {
        navigate("/routes/create-v1");
      } else {
        navigate("/routes/create");
      }
    }
  }, [isRegular, searchParams, routeAccess, navigate, setSearchParams]);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  // Fetch Regions for this organization
  const { data: regionData, isLoading: isRegionsLoading, refetch: refetchRegions } =
    regionCrud.useList({
      filters: {
        organization_id: activeOrgId || "",
      },
      orderBy: { column: "created_at", ascending: true },
      skip: !activeOrgId,
    });

  // Fetch Depots for selected region
  const { data: depotData, isLoading: isDepotsLoading, refetch: refetchDepots } =
    depotCrud.useList({
      filters: {
        region_id: selectedRegion?.id || "",
      },
      orderBy: { column: "created_at", ascending: true },
      skip: !selectedRegion?.id,
    });

  // Fetch Routes for selected depot and active organization
  const {
    data: routesData,
    isLoading: isRoutesLoading,
    refetch: refetchRoutes,
  } = routeCrud.useList({
    filters: {
      depot_id: selectedDepot?.id || "",
      organization_id: activeOrgId || "",
    },
    orderBy: { column: "created_at", ascending: false },
    custom(query) {
      return query.select(`*, created_by_user:created_by (email)`);
    },
    skip: !selectedDepot?.id || !activeOrgId,
  });

  // Mutations
  const { mutateAsync: deleteRouteMutation, isPending: isDeletingSingle } =
    routeCrud.useDelete();
  const { mutateAsync: deleteSelectedRoutesMutation, isPending: isDeletingBulk } =
    routeCrud.useDeleteAll();

  const regions = useMemo(
    () => (regionData?.data as IRegion[]) || [],
    [regionData]
  );
  const depots = useMemo(
    () => (depotData?.data as IDepot[]) || [],
    [depotData]
  );
  const rawRoutes = useMemo(() => {
    const list = (routesData?.data as IRoute[]) || [];
    return sortByLatestCreated(list);
  }, [routesData]);

  const userRegionId = user?.region?.id || (user as any)?.region_id;
  const userDepotId = user?.depot?.id || (user as any)?.depot_id;

  const visibleRegions = useMemo(() => {
    if (isRegionOrDepotAdmin && userRegionId) {
      const filtered = regions.filter((r) => r.id === userRegionId);
      return filtered.length > 0 ? filtered : regions;
    }
    return regions;
  }, [regions, isRegionOrDepotAdmin, userRegionId]);

  const visibleDepots = useMemo(() => {
    if (isDepotAdmin && userDepotId) {
      const filtered = depots.filter((d) => d.id === userDepotId);
      return filtered.length > 0 ? filtered : depots;
    }
    return depots;
  }, [depots, isDepotAdmin, userDepotId]);

  // Select Item Maps for Shadcn Select
  const regionMap = useMemo(() => {
    const map = new Map<string, string>();
    regions.forEach((r) => map.set(r.id, r.name));
    return map;
  }, [regions]);

  const regionItems = useMemo(
    () => visibleRegions.map((r) => ({ label: r.name, value: r.id })),
    [visibleRegions]
  );

  const depotMap = useMemo(() => {
    const map = new Map<string, string>();
    depots.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [depots]);

  const depotItems = useMemo(
    () => visibleDepots.map((d) => ({ label: d.name, value: d.id })),
    [visibleDepots]
  );

  // ─── Auto-Selection Synchronizers ──────────────────────────────────────────

  // Auto-select or validate Region
  useEffect(() => {
    if (!regionData) return;

    if (regions.length === 0) {
      if (selectedRegion) {
        setRoutesPageRegion(null);
      }
      return;
    }

    const userRegionId = user?.region?.id || (user as any)?.region_id;

    // Auto-select user's assigned region ONLY for region_admin or depot_admin
    if (isRegionOrDepotAdmin && userRegionId) {
      const assigned =
        regions.find((r) => r.id === userRegionId) || user?.region || null;
      if (assigned && selectedRegion?.id !== userRegionId) {
        setRoutesPageRegion(assigned as any);
        return;
      }
    }

    const isSelectedRegionValid = regions.some(
      (region) => region.id === selectedRegion?.id
    );

    // If master, org admin, or selection is invalid, select the first from list
    if (!isSelectedRegionValid && regions.length > 0) {
      setRoutesPageRegion(regions[0] || null);
    }
  }, [regions, regionData, selectedRegion, setRoutesPageRegion, isRegionOrDepotAdmin, user]);

  // Auto-select or validate Depot
  useEffect(() => {
    if (!depotData) return;

    if (depots.length === 0) {
      if (selectedDepot) {
        setRoutesPageDepot(null);
      }
      return;
    }

    const userDepotId = user?.depot?.id || (user as any)?.depot_id;

    // Auto-select user's assigned depot ONLY for depot_admin
    if (isDepotAdmin && userDepotId) {
      const assigned =
        depots.find((d) => d.id === userDepotId) || user?.depot || null;
      if (assigned && selectedDepot?.id !== userDepotId) {
        setRoutesPageDepot(assigned as any);
        return;
      }
    }

    const isSelectedDepotValid = depots.some(
      (depot) => depot.id === selectedDepot?.id
    );

    if (!isSelectedDepotValid && depots.length > 0) {
      setRoutesPageDepot(depots[0] || null);
    }
  }, [depots, depotData, selectedDepot, setRoutesPageDepot, isDepotAdmin, user]);

  // ─── Filtering Logic ────────────────────────────────────────────────────────

  const versionFilteredRoutes = useMemo(() => {
    if (!rawRoutes) return [];
    if (routeAccess.isV1Only) {
      return rawRoutes.filter((r) => r.version === "1.0");
    }
    if (routeAccess.isV2Only) {
      return rawRoutes.filter((r) => r.version !== "1.0");
    }
    if (versionFilter === "v1") {
      return rawRoutes.filter((r) => r.version === "1.0");
    }
    if (versionFilter === "v2") {
      return rawRoutes.filter((r) => r.version !== "1.0");
    }
    return rawRoutes;
  }, [rawRoutes, routeAccess.isV1Only, routeAccess.isV2Only, versionFilter]);

  const filteredRoutes = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return versionFilteredRoutes;

    return versionFilteredRoutes.filter((route) => {
      const routeNo = (route.route_number || "").toLowerCase();
      const split1 = (route.route_number_1 || "").toLowerCase();
      const split2 = (route.route_number_2 || "").toLowerCase();
      const source = (route.source || "").toLowerCase();
      const dest = (route.destination || "").toLowerCase();
      const email = (route.created_by_user?.email || "").toLowerCase();

      return (
        routeNo.includes(search) ||
        split1.includes(search) ||
        split2.includes(search) ||
        source.includes(search) ||
        dest.includes(search) ||
        email.includes(search)
      );
    });
  }, [versionFilteredRoutes, searchTerm]);

  // Selected routes objects lookup
  const selectedRouteIdsSet = useMemo(
    () => new Set(selectedRouteIds),
    [selectedRouteIds]
  );

  const selectedRouteObjects = useMemo(() => {
    if (selectedRouteIds.length === 0) return [];
    return rawRoutes.filter((route) => selectedRouteIdsSet.has(route.id));
  }, [rawRoutes, selectedRouteIdsSet]);

  // ─── Highlight Route Sync ───────────────────────────────────────────────────

  useEffect(() => {
    if (!highlightRouteId || rawRoutes.length === 0) return;
    const target = rawRoutes.find((r) => r.id === highlightRouteId);
    if (target) {
      setSelectedRouteIds((prev) =>
        prev.includes(highlightRouteId) ? prev : [highlightRouteId, ...prev]
      );

      if (target.version === "1.0" && versionFilter === "v2") {
        setVersionFilter("all");
      } else if (target.version !== "1.0" && versionFilter === "v1") {
        setVersionFilter("all");
      }

      const timer = setTimeout(() => {
        const rowElement = document.getElementById(
          `route-row-${highlightRouteId}`
        );
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [highlightRouteId, rawRoutes, versionFilter]);

  // ─── Event Handlers ─────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([refetchRoutes(), refetchDepots(), refetchRegions()]);
      notify.success("Routes refreshed successfully");
    } catch {
      notify.error("Failed to refresh routes");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRegionChange = (val: string | null) => {
    if (!val) return;
    const nextRegion = regions.find((r) => r.id === val) || null;
    setRoutesPageRegion(nextRegion);
  };

  const handleDepotChange = (val: string | null) => {
    if (!val) return;
    const nextDepot = depots.find((d) => d.id === val) || null;
    setRoutesPageDepot(nextDepot);
  };

  const handleAddV1Route = () => {
    if (!activeOrgId || !selectedDepot?.id) return;
    navigate(`/routes/create-v1/${activeOrgId}/${selectedDepot.id}`);
  };

  const handleAddV2Route = () => {
    if (!activeOrgId || !selectedDepot?.id) return;
    navigate(`/routes/create/${activeOrgId}/${selectedDepot.id}`);
  };

  const handleEditRoute = (routeId: string) => {
    const route = rawRoutes.find((r) => r.id === routeId);
    if (!route) return;

    const isV1 = route.version === "1.0";

    if (isV1) {
      if (!routeAccess.hasV1Routes) {
        notify.error("You do not have permission to edit V1 routes");
        return;
      }
      navigate(`/routes/create-v1/${activeOrgId}/${selectedDepot?.id}/${routeId}`);
    } else {
      if (!routeAccess.hasV2Routes) {
        notify.error("You do not have permission to edit V2 routes");
        return;
      }
      navigate(`/routes/create/${activeOrgId}/${selectedDepot?.id}/${routeId}`);
    }
  };

  const handleDuplicateRoute = async (routeId: string, suffix: string = "D") => {
    try {
      const duplicated = await duplicateRoute(routeId, suffix, user?.id);
      notify.success(`Route duplicated as "${duplicated.route_number}"`);
      refetchRoutes();
    } catch (error: any) {
      if (error?.code === "23505" || error?.message?.includes("23505")) {
        notify.error("A route with this number already exists in this depot.");
      } else {
        notify.error(error?.message || "Failed to duplicate route");
      }
    }
  };

  const handleReturnRoute = async (
    routeId: string,
    suffix: string = "(Return)"
  ) => {
    try {
      await createReturnRoute(routeId, suffix, user?.id);
      notify.success("Return route created successfully");
      refetchRoutes();
    } catch (error: any) {
      notify.error(error?.message || "Failed to create return route");
    }
  };

  // Single Route Delete
  const handlePromptDeleteRoute = (route: IRoute) => {
    setDeletingRoute(route);
  };

  const handleConfirmDeleteRoute = async () => {
    if (!deletingRoute) return;
    try {
      await deleteRouteMutation(deletingRoute.id);
      notify.success(`Route "${deletingRoute.route_number}" deleted successfully`);
      setSelectedRouteIds((prev) => prev.filter((id) => id !== deletingRoute.id));
      setDeletingRoute(null);
      refetchRoutes();
    } catch (error: any) {
      notify.error(error?.message || "Failed to delete route");
    }
  };

  // Multi-route Selection Handlers
  const handleSelectedChange = (routeId: string, selected: boolean) => {
    setSelectedRouteIds((prev) =>
      selected ? [...prev, routeId] : prev.filter((id) => id !== routeId)
    );
  };

  const handleSelectAllChange = (checked: boolean) => {
    if (checked && filteredRoutes.length > 0) {
      setSelectedRouteIds(filteredRoutes.map((r) => r.id));
    } else {
      setSelectedRouteIds([]);
    }
  };

  // Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (selectedRouteIds.length === 0) return;
    try {
      await deleteSelectedRoutesMutation(selectedRouteIds);
      notify.success(
        `${selectedRouteIds.length} route(s) deleted successfully`
      );
      setSelectedRouteIds([]);
      setIsBulkDeleteOpen(false);
      refetchRoutes();
    } catch (error: any) {
      notify.error(error?.message || "Failed to delete selected routes");
    }
  };

  // Export Selected Routes
  const handleExportSelectedRoutes = () => {
    if (selectedRouteObjects.length === 0) {
      notify.warning("No routes selected for export");
      return;
    }

    const hasV1Routes = selectedRouteObjects.some((r) => r.version === "1.0");
    const hasV2Routes = selectedRouteObjects.some((r) => r.version !== "1.0");

    if (hasV1Routes && hasV2Routes) {
      setIsMixedVersionDialogOpen(true);
      return;
    }

    executeExport(hasV1Routes ? "v1" : "v2");
  };

  const executeExport = async (format: "v1" | "v2") => {
    if (selectedRouteObjects.length === 0) {
      notify.warning("No routes selected for export");
      return;
    }

    try {
      setIsExporting(true);
      notify.info(`Requesting ${format.toUpperCase()} export package...`);
      await exportRoutes(selectedRouteObjects, format, {
        organizationId: activeOrgId,
        depotId: selectedDepot?.id,
      });
      await useWifiTransferStore.getState().loadPendingPackage();
      useWifiTransferStore.getState().openDialog();
      notify.success(
        `Package prepared for Signboard Wi-Fi Transfer (${selectedRouteObjects.length} route(s))`
      );
    } catch (error: any) {
      notify.error(error?.message || `Export failed for ${format.toUpperCase()} format`);
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Status & Counts ────────────────────────────────────────────────────────

  const v1Count = useMemo(
    () => rawRoutes.filter((r) => r.version === "1.0").length,
    [rawRoutes]
  );
  const v2Count = useMemo(
    () => rawRoutes.filter((r) => r.version !== "1.0").length,
    [rawRoutes]
  );

  const hasRegions = regions.length > 0;
  const hasDepots = depots.length > 0;
  const hasRoutes = filteredRoutes.length > 0;

  // ─── Render Layout ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <RouteIcon className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Routes
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage transit routes, display configurations, and fleet exports for{" "}
          <strong className="text-foreground">{activeOrgName}</strong>
          {selectedDepot ? (
            <>
              {" "}—{" "}
              <span className="font-semibold text-foreground">
                {selectedDepot.name}
              </span>
            </>
          ) : null}
          .
        </p>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-end gap-3">
        

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Signboard Wi-Fi Transfer Badge */}
          <WifiTransferStatusBadge />

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
            <span>Refresh</span>
          </Button>

          {/* Add Route Buttons (Roles Restricted) */}
          {canManage && !isGuest && (
            <>
              {routeAccess.hasV1Routes && (
                <Button
                  variant={routeAccess.hasV2Routes ? "outline" : "default"}
                  size="sm"
                  onClick={handleAddV1Route}
                  disabled={!selectedDepot}
                  className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
                  title={!selectedDepot ? "Select a depot first" : undefined}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {routeAccess.isV1Only ? "Add Route" : "V1 Add Route"}
                  </span>
                </Button>
              )}

              {routeAccess.hasV2Routes && (
                <Button
                  size="sm"
                  onClick={handleAddV2Route}
                  disabled={!selectedDepot}
                  className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
                  title={!selectedDepot ? "Select a depot first" : undefined}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {routeAccess.isV2Only ? "Add Route" : "V2 Add Route"}
                  </span>
                </Button>
              )}
            </>
          )}

          {/* Bulk Action Buttons (When rows are selected) */}
          {selectedRouteIds.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSelectedRoutes}
                disabled={isExporting}
                className="h-9 gap-1.5 text-xs font-medium"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-primary" />
                )}
                <span>Export ({selectedRouteIds.length})</span>
              </Button>

              {canManage && !isGuest && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteOpen(true)}
                  className="h-9 gap-1.5 text-xs font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete All ({selectedRouteIds.length})</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
        {/* Action Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left Side: Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-3xl flex-wrap">
          {/* Search Input */}
          <div className=" min-w-[220px]">
            <Field>
              <FieldLabel>Search</FieldLabel>

              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by route number, source, destination, or creator..."
                className="pl-9 pr-8 h-9 text-xs"
              />
            </Field>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Region Select */}
          {hasRegions && (
            <div className="w-full sm:w-[190px] shrink-0">
              <Field>
                <FieldLabel>Select Region</FieldLabel>
                <Select
                  value={selectedRegion?.id ?? ""}
                  onValueChange={handleRegionChange}
                  items={regionItems}
                  disabled={isRegionOrDepotAdmin}
                >
                  <SelectTrigger className="h-9 text-xs w-full">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Select region...">
                        {(val: string | null) => {
                          if (!val) return null;
                          return regionMap.get(val) || val;
                        }}
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {visibleRegions.map((reg) => (
                      <SelectItem key={reg.id} value={reg.id}>
                        {reg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {/* Depot Select */}
          {hasDepots && (
            <div className="w-full sm:w-[190px] shrink-0">
              <Field>
                <FieldLabel>Select Depot</FieldLabel>
                <Select
                  value={selectedDepot?.id ?? ""}
                  onValueChange={handleDepotChange}
                  items={depotItems}
                  disabled={isDepotAdmin}
                >
                  <SelectTrigger className="h-9 text-xs w-full">
                    <div className="flex items-center gap-1.5 truncate">
                      <Warehouse className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Select depot...">
                        {(val: string | null) => {
                          if (!val) return null;
                          return depotMap.get(val) || val;
                        }}
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {visibleDepots.map((depot) => (
                      <SelectItem key={depot.id} value={depot.id}>
                        {depot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
        </div>

       
      </div>

      {/* Meta Bar: Record Count & Version Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-foreground">{filteredRoutes.length}</strong> of{" "}
            <strong className="text-foreground">{rawRoutes.length}</strong> records
          </span>

          {selectedRouteIds.length > 0 && (
            <Badge variant="secondary" className="text-[11px] h-5 font-medium">
              {selectedRouteIds.length} selected
            </Badge>
          )}
        </div>

        {/* Dual User / Super Admin Version Segmented Pills */}
        {(routeAccess.isDualUser || isSuper) && rawRoutes.length > 0 && (
          <div className="inline-flex items-center rounded-lg bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setVersionFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                versionFilter === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              )}
            >
              All ({rawRoutes.length})
            </button>
            <button
              type="button"
              onClick={() => setVersionFilter("v1")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                versionFilter === "v1"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              )}
            >
              V1 ({v1Count})
            </button>
            <button
              type="button"
              onClick={() => setVersionFilter("v2")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                versionFilter === "v2"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              )}
            >
              V2 ({v2Count})
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!activeOrgId ? (
        /* No Organization Selected Prompt */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Organization Selected
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Please choose an active organization from the top bar selector to manage its transit routes.
          </p>
        </div>
      ) : regions.length === 0 && !isRegionsLoading ? (
        /* No Regions Found */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
            <Box className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Administrative Regions Found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Routes belong to operational depots inside administrative regions.
            Please configure at least one region first.
          </p>
          <Link to="/home/regions">
            <Button size="sm" className="mt-4 text-xs font-semibold gap-1.5 shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Configure Regions First</span>
            </Button>
          </Link>
        </div>
      ) : depots.length === 0 && !isDepotsLoading ? (
        /* No Depots Found */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
            <Warehouse className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Depots Found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            No operational depots have been created for {selectedRegion?.name || "this region"}.
            Routes must belong to a depot facility.
          </p>
          <Link to="/home/depots">
            <Button size="sm" className="mt-4 text-xs font-semibold gap-1.5 shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Configure Depots First</span>
            </Button>
          </Link>
        </div>
      ) : !hasRoutes && !isRoutesLoading ? (
        /* Empty Routes State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <RouteIcon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Routes Found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {searchTerm
              ? `No routes match "${searchTerm}" in this depot.`
              : versionFilter !== "all"
                ? `No ${versionFilter.toUpperCase()} routes found for this depot.`
                : `No routes have been created for ${selectedDepot?.name || "this depot"} yet.`}
          </p>
          {searchTerm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="mt-4 text-xs"
            >
              Clear Search Filter
            </Button>
          ) : canManage && !isGuest && selectedDepot ? (
            <div className="flex items-center gap-2 mt-4">
              {routeAccess.hasV1Routes && (
                <Button
                  size="sm"
                  variant={routeAccess.hasV2Routes ? "outline" : "default"}
                  onClick={handleAddV1Route}
                  className="text-xs font-semibold gap-1.5 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {routeAccess.isV1Only ? "Create Route" : "Create V1 Route"}
                  </span>
                </Button>
              )}
              {routeAccess.hasV2Routes && (
                <Button
                  size="sm"
                  onClick={handleAddV2Route}
                  className="text-xs font-semibold gap-1.5 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {routeAccess.isV2Only ? "Create Route" : "Create V2 Route"}
                  </span>
                </Button>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        /* Routes Table */
        <RouteTable
          routes={filteredRoutes}
          selectedRouteIds={selectedRouteIds}
          onSelectedChange={handleSelectedChange}
          onSelectAllChange={handleSelectAllChange}
          highlightedRouteId={highlightRouteId}
          onEdit={handleEditRoute}
          onDuplicate={handleDuplicateRoute}
          onReturn={handleReturnRoute}
          onDelete={handlePromptDeleteRoute}
          isGuest={isGuest}
          isLoading={isRoutesLoading}
        />
      )}

      {/* Delete Single Route Dialog */}
      <Dialog
        open={Boolean(deletingRoute)}
        onOpenChange={(open) => !open && setDeletingRoute(null)}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold">
              Delete Route
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-1">
              <span>
                This action cannot be undone. Are you sure you want to permanently delete route{" "}
                <strong className="text-foreground">
                  "{deletingRoute?.route_number}"
                </strong>
                ?
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDeleteRoute}
              disabled={isDeletingSingle}
              className="text-xs font-semibold gap-1.5"
            >
              {isDeletingSingle ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Route
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Multiple Routes Dialog */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold">
              Delete Selected Routes
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-1">
              <span>
                This action cannot be undone. Are you sure you want to permanently delete{" "}
                <strong className="text-foreground">
                  {selectedRouteIds.length} selected route(s)
                </strong>
                ?
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmBulkDelete}
              disabled={isDeletingBulk}
              className="text-xs font-semibold gap-1.5"
            >
              {isDeletingBulk ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete ({selectedRouteIds.length}) Routes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mixed Version Export Conflict Dialog */}
      <MixedVersionExportDialog
        open={isMixedVersionDialogOpen}
        onOpenChange={setIsMixedVersionDialogOpen}
      />

      {/* Signboard Wi-Fi Transfer Dialog */}
      <WifiTransferDialog />
    </div>
  );
}

export default RoutesPage;
