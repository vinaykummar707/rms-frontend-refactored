import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "cn";
import { useAuthStore } from "@/core/auth/authStore";
import { useAuthorization } from "@/core/authorization/useAuthorization";
import { routeCrud } from "@/features/routes/api/routeCrud";
import {
  createReturnRoute,
  duplicateRoute,
  exportRoutes,
} from "@/features/routes/services/routeService";
import { sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import type { IRoute } from "@/shared/types/route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RouteTable } from "@/pages/routes/components/RouteTable";
import { MixedVersionExportDialog } from "@/pages/routes/components/MixedVersionExportDialog";
import {
  WifiTransferStatusBadge,
  WifiTransferDialog,
  useWifiTransferStore,
} from "@/features/wifiTransfer";
import {
  Navigation,
  Plus,
  RefreshCw,
  Download,
  Trash2,
  Search,
  User as UserIcon,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";

export function RegularRoutesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const user = useAuthStore((state) => state.user);
  const {
    routeAccess,
    isRegularCustomer: isRegular,
    isSuperAdmin: isSuper,
  } = useAuthorization();

  const highlightRouteId =
    searchParams.get("highlightRouteId") || searchParams.get("routeId");

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [createdBySearch, setCreatedBySearch] = useState("");
  const [versionFilter, setVersionFilter] = useState<"all" | "v1" | "v2">("all");
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Dialogs
  const [deletingRoute, setDeletingRoute] = useState<IRoute | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isMixedVersionDialogOpen, setIsMixedVersionDialogOpen] = useState(false);

  // Auto-open route creation if URL has ?create=true
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setSearchParams({}, { replace: true });
      if (routeAccess.isV1Only) {
        navigate("/routes/create-v1");
      } else {
        navigate("/routes/create");
      }
    }
  }, [searchParams, routeAccess.isV1Only, navigate, setSearchParams]);

  // Query: if Regular, only user's own routes. If Super Admin, all standalone routes (depot_id is null)
  const {
    data: routesData,
    refetch: refetchRoutes,
    isLoading: isRoutesLoading,
  } = routeCrud.useList({
    filters: isRegular
      ? {
          created_by: user?.id || "",
        }
      : {},
    orderBy: { column: "created_at", ascending: false },
    custom(query) {
      let q = query.select(`*, created_by_user:created_by (email)`);
      if (isSuper) {
        q = q.is("depot_id", null);
      }
      return q;
    },
    skip: isRegular ? !user?.id : false,
  });

  const { mutateAsync: deleteRouteMutation, isPending: isDeletingSingle } =
    routeCrud.useDelete();
  const { mutateAsync: deleteSelectedRoutesMutation, isPending: isDeletingBulk } =
    routeCrud.useDeleteAll();

  const rawRoutes = useMemo(() => {
    const list = (routesData?.data as IRoute[]) || [];
    return sortByLatestCreated(list);
  }, [routesData]);

  // Version Filter
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

  // Search Filter
  const filteredRoutes = useMemo(() => {
    let result = versionFilteredRoutes;

    const creatorQuery = createdBySearch.trim().toLowerCase();
    if (creatorQuery) {
      result = result.filter((r) =>
        (r.created_by_user?.email || "").toLowerCase().includes(creatorQuery)
      );
    }

    const query = searchTerm.trim().toLowerCase();
    if (query) {
      result = result.filter((r) => {
        const routeNum = (r.route_number || "").toLowerCase();
        const routeNum1 = (r.route_number_1 || "").toLowerCase();
        const routeNum2 = (r.route_number_2 || "").toLowerCase();
        const source = (r.source || "").toLowerCase();
        const destination = (r.destination || "").toLowerCase();
        const via = (r.via || "").toLowerCase();
        const email = (r.created_by_user?.email || "").toLowerCase();

        return (
          routeNum.includes(query) ||
          routeNum1.includes(query) ||
          routeNum2.includes(query) ||
          source.includes(query) ||
          destination.includes(query) ||
          via.includes(query) ||
          email.includes(query)
        );
      });
    }

    return result;
  }, [versionFilteredRoutes, searchTerm, createdBySearch]);

  const selectedRouteIdsSet = useMemo(
    () => new Set(selectedRouteIds),
    [selectedRouteIds]
  );

  const selectedRouteObjects = useMemo(() => {
    if (selectedRouteIds.length === 0) return [];
    return rawRoutes.filter((route) => selectedRouteIdsSet.has(route.id));
  }, [rawRoutes, selectedRouteIdsSet]);

  // Auto-focus, select, and scroll to highlighted route from navigation
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

  // Navigation handlers
  const handleAddV1Route = () => {
    navigate("/routes/create-v1");
  };

  const handleAddV2Route = () => {
    navigate("/routes/create");
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
      navigate(`/routes/create-v1/${routeId}`);
    } else {
      if (!routeAccess.hasV2Routes) {
        notify.error("You do not have permission to edit V2 routes");
        return;
      }
      navigate(`/routes/create/${routeId}`);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refetchRoutes();
      notify.success("Routes refreshed successfully");
    } catch {
      notify.error("Failed to refresh routes");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDuplicateRoute = async (routeId: string, suffix: string = "D") => {
    try {
      const duplicated = await duplicateRoute(routeId, suffix, user?.id);
      notify.success(`Route duplicated as "${duplicated.route_number}"`);
      refetchRoutes();
    } catch (error: any) {
      if (error?.code === "23505" || error?.message?.includes("23505")) {
        notify.error("A route with this number already exists in your account.");
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

  const handleConfirmBulkDelete = async () => {
    if (selectedRouteIds.length === 0) return;
    try {
      await deleteSelectedRoutesMutation(selectedRouteIds);
      notify.success(`${selectedRouteIds.length} route(s) deleted successfully`);
      setSelectedRouteIds([]);
      setIsBulkDeleteOpen(false);
      refetchRoutes();
    } catch (error: any) {
      notify.error(error?.message || "Failed to delete selected routes");
    }
  };

  const handleExportSelectedRoutes = () => {
    if (selectedRouteObjects.length === 0) {
      notify.warning("No routes selected for export");
      return;
    }

    const hasV1 = selectedRouteObjects.some((r) => r.version === "1.0");
    const hasV2 = selectedRouteObjects.some((r) => r.version !== "1.0");

    if (hasV1 && hasV2) {
      setIsMixedVersionDialogOpen(true);
      return;
    }

    executeExport(hasV1 ? "v1" : "v2");
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
        fileNamePrefix: "regular_routes",
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

  const v1Count = useMemo(
    () => rawRoutes.filter((r) => r.version === "1.0").length,
    [rawRoutes]
  );
  const v2Count = useMemo(
    () => rawRoutes.filter((r) => r.version !== "1.0").length,
    [rawRoutes]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Navigation className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {isRegular ? "My Routes" : "Regular Customer Routes"}
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {isRegular
            ? "Create and manage your standalone custom transit routes."
            : "View and manage standalone transit routes created by regular customers across the platform."}
        </p>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl flex-wrap">
          {/* Main Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search route number, terminal, stop..."
              className="pl-9 pr-8 h-9 text-xs"
            />
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

          {/* Admin Created By Search */}
          {!isRegular && (
            <div className="relative w-full sm:w-[220px]">
              <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={createdBySearch}
                onChange={(e) => setCreatedBySearch(e.target.value)}
                placeholder="Search creator email..."
                className="pl-9 pr-8 h-9 text-xs"
              />
              {createdBySearch && (
                <button
                  type="button"
                  onClick={() => setCreatedBySearch("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear creator search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <WifiTransferStatusBadge />

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

          {routeAccess.hasV1Routes && (
            <Button
              variant={routeAccess.hasV2Routes ? "outline" : "default"}
              size="sm"
              onClick={handleAddV1Route}
              className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
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
              className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>
                {routeAccess.isV2Only ? "Add Route" : "V2 Add Route"}
              </span>
            </Button>
          )}

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

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteOpen(true)}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete ({selectedRouteIds.length})</span>
              </Button>
            </>
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

      {/* Content Area */}
      {rawRoutes.length === 0 && !isRoutesLoading ? (
        /* Empty Routes State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Navigation className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Routes Found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {isRegular
              ? "You haven't created any standalone routes yet. Get started by creating your first route."
              : "No regular customer routes have been created on the system yet."}
          </p>
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
        </div>
      ) : filteredRoutes.length === 0 && !isRoutesLoading ? (
        /* No Matching Search Results */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Matching Routes
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            No routes matched "{[searchTerm, createdBySearch].filter(Boolean).join(" / ")}".
            Try searching for a different keyword or reset the filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setCreatedBySearch("");
            }}
            className="mt-4 text-xs"
          >
            Clear Search
          </Button>
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
          isGuest={false}
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

export default RegularRoutesPage;

