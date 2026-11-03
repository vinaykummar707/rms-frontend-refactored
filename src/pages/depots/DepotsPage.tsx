import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { cn } from "cn";
import { useOrganizationStore } from "@/features/stores/useOrganizationStore";
import { useRegionStore } from "@/features/stores/useRegionStore";
import { useDepotStore } from "@/features/stores/useDepotStore";
import { useAuthStore } from "@/core/auth/authStore";
import { regionCrud } from "@/features/regions/api/regionCrud";
import { depotCrud } from "@/features/depots/api/depotCrud";
import {
  checkDepotNameDuplicate,
  getDepotDeleteImpactMessage,
} from "@/features/depots/services/depotService";
import { formatDate, sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import type { IRegion } from "@/shared/types/region";
import type { IDepot } from "@/shared/types/depot";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Warehouse,
  Building2,
  Calendar,
  Pencil,
  Trash2,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Compass,
  Filter,
  Box,
} from "lucide-react";

export function DepotsPage() {
  const user = useAuthStore((state) => state.user);
  const { selectedOrganization } = useOrganizationStore();
  const { selectedDepot, setSelectedDepot } = useDepotStore();
  const selectedRegion = useRegionStore(
    (state) => state.depotsPageRegion ?? state.selectedRegion
  );
  const setDepotsPageRegion = useRegionStore((state) => state.setDepotsPageRegion);

  const activeOrgId =
    selectedOrganization?.id || user?.organization_id || user?.organization?.id;
  const activeOrgName =
    selectedOrganization?.name || user?.organization?.name || "Organization";

  const userRole = user?.role?.name?.toLowerCase() || "";
  const isRegionOrDepotAdmin =
    userRole === "region_admin" || userRole === "depot_admin";
  const canManage =
    userRole === "region_admin" ||
    userRole === "organization_admin" ||
    userRole === "master";

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createRegionId, setCreateRegionId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createNameError, setCreateNameError] = useState("");
  const [createRegionError, setCreateRegionError] = useState("");

  const [editingDepot, setEditingDepot] = useState<IDepot | null>(null);
  const [editRegionId, setEditRegionId] = useState("");
  const [editName, setEditName] = useState("");
  const [editNameError, setEditNameError] = useState("");
  const [editRegionError, setEditRegionError] = useState("");

  const [deletingDepot, setDeletingDepot] = useState<IDepot | null>(null);
  const [deleteImpactMsg, setDeleteImpactMsg] = useState("");
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);

  // Fetch Regions for this organization
  const { useList: useRegionList } = regionCrud;
  const {
    data: regionData,
    isLoading: isRegionsLoading,
    refetch: refetchRegions,
  } = useRegionList({
    filters: { organization_id: activeOrgId || "" },
    orderBy: { column: "created_at", ascending: true },
    skip: !activeOrgId,
  });

  const regions = useMemo(() => {
    return (regionData?.data as IRegion[]) || [];
  }, [regionData]);

  const regionMap = useMemo(() => {
    const map = new Map<string, string>();
    regions.forEach((r) => map.set(r.id, r.name));
    return map;
  }, [regions]);

  const regionItems = useMemo(() => {
    return regions.map((r) => ({ label: r.name, value: r.id }));
  }, [regions]);

  // Keep selectedRegion synchronized with available regions
  useEffect(() => {
    if (!regions || regions.length === 0) {
      if (selectedRegion) {
        setDepotsPageRegion(null);
      }
      return;
    }

    const userRegionId = user?.region?.id || user?.region_id;

    // Restricted users bound to their assigned region
    if (isRegionOrDepotAdmin && userRegionId) {
      const assigned =
        regions.find((r) => r.id === userRegionId) || user?.region || null;
      if (assigned && selectedRegion?.id !== userRegionId) {
        setDepotsPageRegion(assigned as any);
        return;
      }
    }

    const isSelectedRegionValid = regions.some(
      (r) => r.id === selectedRegion?.id
    );
    if (!isSelectedRegionValid && regions.length > 0) {
      setDepotsPageRegion(regions[0]);
    }
  }, [regions, selectedRegion, setDepotsPageRegion, isRegionOrDepotAdmin, user]);

  // Fetch Depots for this organization & selected region
  const { useList: useDepotList, useCreate, useUpdate, useDelete } = depotCrud;
  const {
    data: depotData,
    isLoading: isDepotsLoading,
    isError,
    refetch: refetchDepots,
  } = useDepotList({
    filters: {
      organization_id: activeOrgId || "",
      region_id: selectedRegion?.id || "",
    },
    orderBy: { column: "created_at", ascending: false },
    skip: !activeOrgId || !selectedRegion?.id,
  });

  const { mutateAsync: createDepot, isPending: isCreating } = useCreate();
  const { mutateAsync: updateDepot, isPending: isUpdating } = useUpdate();
  const { mutateAsync: deleteDepot, isPending: isDeleting } = useDelete();

  const rawDepots = useMemo(() => {
    if (!selectedRegion?.id) return [];
    const list = (depotData?.data as IDepot[]) || [];
    return sortByLatestCreated(list);
  }, [depotData, selectedRegion?.id]);

  const filteredDepots = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return rawDepots;
    return rawDepots.filter(
      (depot) =>
        depot.name.toLowerCase().includes(search) ||
        (depot.region_id && regionMap.get(depot.region_id)?.toLowerCase().includes(search))
    );
  }, [rawDepots, searchTerm, regionMap]);

  // Handle Refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([refetchDepots(), refetchRegions()]);
      notify.info("Depot list refreshed");
    } finally {
      setIsRefreshing(false);
    }
  };

  // ----------------------------------------------------
  // Create Depot
  // ----------------------------------------------------
  const handleOpenCreate = () => {
    setCreateName("");
    setCreateNameError("");
    setCreateRegionError("");
    // Default to the currently selected region or first available
    const initialRegion = selectedRegion?.id || regions[0]?.id || "";
    setCreateRegionId(initialRegion);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) return;

    let hasError = false;
    if (!createRegionId) {
      setCreateRegionError("Please select an assigned parent region.");
      hasError = true;
    }

    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateNameError("Depot name is required.");
      hasError = true;
    } else if (trimmed.length < 2) {
      setCreateNameError("Depot name must be at least 2 characters.");
      hasError = true;
    }

    if (hasError) return;

    try {
      const isDuplicate = await checkDepotNameDuplicate(trimmed, createRegionId);
      if (isDuplicate) {
        setCreateNameError(`Depot "${trimmed}" already exists under this region.`);
        return;
      }

      await createDepot({
        name: trimmed,
        organization_id: activeOrgId,
        region_id: createRegionId,
      });

      notify.success("Depot created successfully", `"${trimmed}" is now configured.`);
      setIsCreateOpen(false);
      refetchDepots();
    } catch (err: any) {
      notify.error(err.message || "Failed to create depot");
    }
  };

  // ----------------------------------------------------
  // Edit Depot
  // ----------------------------------------------------
  const handleOpenEdit = (depot: IDepot) => {
    setEditingDepot(depot);
    setEditName(depot.name || "");
    setEditRegionId(depot.region_id || "");
    setEditNameError("");
    setEditRegionError("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDepot || !activeOrgId) return;

    let hasError = false;
    if (!editRegionId) {
      setEditRegionError("Please select an assigned parent region.");
      hasError = true;
    }

    const trimmed = editName.trim();
    if (!trimmed) {
      setEditNameError("Depot name is required.");
      hasError = true;
    } else if (trimmed.length < 2) {
      setEditNameError("Depot name must be at least 2 characters.");
      hasError = true;
    }

    if (hasError) return;

    try {
      const isDuplicate = await checkDepotNameDuplicate(
        trimmed,
        editRegionId,
        editingDepot.id
      );
      if (isDuplicate) {
        setEditNameError(`Depot "${trimmed}" already exists under this region.`);
        return;
      }

      await updateDepot({
        id: editingDepot.id,
        payload: {
          id: editingDepot.id,
          name: trimmed,
          organization_id: editingDepot.organization_id,
          region_id: editRegionId,
        },
      });

      notify.success("Depot updated successfully", `Saved changes for "${trimmed}".`);
      setEditingDepot(null);
      refetchDepots();
    } catch (err: any) {
      notify.error(err.message || "Failed to update depot");
    }
  };

  // ----------------------------------------------------
  // Delete Depot
  // ----------------------------------------------------
  const handlePromptDelete = async (depot: IDepot) => {
    setDeletingDepot(depot);
    setDeleteImpactMsg("");
    setIsLoadingImpact(true);
    try {
      const msg = await getDepotDeleteImpactMessage(depot.id);
      setDeleteImpactMsg(msg);
    } catch {
      setDeleteImpactMsg(
        "Deleting this depot will permanently delete all associated routes and stop configurations."
      );
    } finally {
      setIsLoadingImpact(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDepot) return;

    try {
      await deleteDepot(deletingDepot.id);

      if (selectedDepot && selectedDepot.id === deletingDepot.id) {
        setSelectedDepot(null);
      }

      notify.success("Depot deleted successfully", `Removed "${deletingDepot.name}".`);
      setDeletingDepot(null);
      refetchDepots();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete depot");
    }
  };

  const isLoading = isRegionsLoading || isDepotsLoading;

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Depots
          </h1>
          <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5">
            {filteredDepots.length} Total
          </Badge>
          {selectedRegion && (
            <Badge variant="outline" className="font-semibold text-xs px-2 py-0.5 border-primary/30 text-primary">
              Region: {selectedRegion.name}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Manage operating terminals, fleet sheds, and division allocations for{" "}
          <strong className="text-foreground">{activeOrgName}</strong>.
        </p>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search and Region Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by depot or region name..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Region Selector Dropdown */}
          {!isRegionOrDepotAdmin && regions.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <Label
                htmlFor="depot-region-filter"
                className="text-xs font-semibold text-foreground whitespace-nowrap"
              >
                Select Region:
              </Label>
              <div className="w-full sm:w-[200px]">
                <Select
                  value={selectedRegion?.id ?? ""}
                  onValueChange={(val) => {
                    if (val) {
                      const match = regions.find((r) => r.id === val);
                      if (match) setDepotsPageRegion(match);
                    }
                  }}
                  items={regionItems}
                >
                  <SelectTrigger id="depot-region-filter" className="h-9 text-xs w-full">
                    <div className="flex items-center gap-1.5 truncate">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Select region...">
                        {(val: string | null) => {
                          if (!val) return null;
                          return regionMap.get(val) || val;
                        }}
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((reg) => (
                      <SelectItem key={reg.id} value={reg.id}>
                        {reg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              disabled={regions.length === 0}
              className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
              title={
                regions.length === 0
                  ? "Create at least one region first before adding depots"
                  : "Create Depot"
              }
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Depot</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* No Active Organization Selected */}
      {!activeOrgId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Organization Selected
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Please choose an active organization from the top bar selector to manage its fleet depots.
          </p>
        </div>
      ) : regions.length === 0 && !isRegionsLoading ? (
        /* No Regions Prompt */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
            <Box className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Administrative Regions Found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Depots must belong to an administrative region. Please configure at least one region first.
          </p>
          <Link to="/home/regions">
            <Button size="sm" className="mt-4 text-xs font-semibold gap-1.5 shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Configure Regions First</span>
            </Button>
          </Link>
        </div>
      ) : isLoading ? (
        /* Loading Skeletons */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="space-y-4 p-4">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-6 w-1/2" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      ) : isError ? (
        /* Error State */
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center">
          <p className="text-sm font-medium text-destructive">
            Failed to load depots. Please check your network connection.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="mt-3 text-xs"
          >
            Try Again
          </Button>
        </div>
      ) : filteredDepots.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Warehouse className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No depots found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {searchTerm
              ? `No depots match "${searchTerm}" in ${selectedRegion?.name || "this region"}.`
              : `No operating depots have been configured for ${selectedRegion?.name || "this region"} yet.`}
          </p>
          {searchTerm ? (
            <div className="flex items-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm("")}
                className="text-xs"
              >
                Clear Search
              </Button>
            </div>
          ) : (
            canManage && (
              <Button
                size="sm"
                onClick={handleOpenCreate}
                className="mt-4 text-xs font-semibold gap-1.5 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Depot</span>
              </Button>
            )
          )}
        </div>
      ) : (
        /* Depots Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {filteredDepots.map((depot) => {
            const initials = depot.name.slice(0, 2).toUpperCase();
            const parentRegionName =
              regionMap.get(depot.region_id) || "Unassigned Region";

            return (
              <Card
                key={depot.id}
                className="relative flex flex-col justify-between transition-all duration-200 border-border/80 bg-card hover:border-foreground/20 hover:shadow-md"
              >
                <div>
                  {/* Card Header */}
                  <CardHeader className=" pb-2.5 block w-full min-w-0">
                    <div className="flex items-start justify-between gap-2 w-full min-w-0">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <Avatar className="h-9 w-9 rounded-xl after:rounded-xl shrink-0 mt-0.5">
                          <AvatarFallback className="rounded-xl text-xs font-bold text-white bg-indigo-600 shadow-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                       
                      </div>
                    </div>
                  </CardHeader>

                  {/* Card Content */}
                  <CardContent className="p-3.5 pt-0 space-y-2"> <div className="min-w-0 flex-1">
                          <CardTitle
                            className="text-sm font-semibold leading-snug text-foreground line-clamp-2 break-words [overflow-wrap:anywhere]"
                            title={depot.name}
                          >
                            {depot.name}
                          </CardTitle>
                        </div>
                    {/* Parent Region */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-3 border-t border-border/60">
                      <Compass className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate font-medium text-foreground" title={parentRegionName}>
                        {parentRegionName}
                      </span>
                    </div>

                    {/* Created Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      <span>Created {formatDate(depot.created_at)}</span>
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer */}
                {canManage && (
                  <CardFooter className="px-3.5 py-2.5 border-t border-border/80 flex items-center justify-end gap-1.5 bg-muted/20">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(depot)}
                      className="h-7 text-xs px-2.5 gap-1 hover:bg-muted font-medium"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePromptDelete(depot)}
                      className="h-7 text-xs px-2.5 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-input"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Depot Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open, details?: any) => {
          if (!open) {
            if (
              details?.reason === "outside-press" ||
              details?.reason === "outsidePress"
            ) {
              return;
            }
            setIsCreateOpen(false);
          }
        }}
        disablePointerDismissal={true}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Create Depot</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Add an operational terminal facility to {activeOrgName}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {/* Region Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assigned Region *</Label>
              <Select
                value={createRegionId}
                onValueChange={(val) => {
                  setCreateRegionId(val ?? "");
                  if (createRegionError) setCreateRegionError("");
                }}
                items={regionItems}
              >
                <SelectTrigger
                  className={cn(
                    "h-9 text-xs w-full",
                    createRegionError && "border-destructive focus-visible:ring-destructive/20"
                  )}
                >
                  <SelectValue placeholder="Select parent region...">
                    {(val: string | null) => {
                      if (!val) return null;
                      return regionMap.get(val) || val;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {regions.map((reg) => (
                    <SelectItem key={reg.id} value={reg.id}>
                      {reg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createRegionError && (
                <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{createRegionError}</span>
                </p>
              )}
            </div>

            {/* Depot Name Input */}
            <div className="space-y-1.5">
              <Label htmlFor="create-depot-name" className="text-xs font-semibold">
                Depot Name *
              </Label>
              <Input
                id="create-depot-name"
                value={createName}
                onChange={(e) => {
                  setCreateName(e.target.value);
                  if (createNameError) setCreateNameError("");
                }}
                placeholder="e.g. Depot 28 - Hebbal"
                className={cn(
                  "h-9 text-xs",
                  createNameError && "border-destructive focus-visible:ring-destructive/20"
                )}
                autoFocus
              />
              {createNameError && (
                <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{createNameError}</span>
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreating}
                className="text-xs font-semibold gap-1.5"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Create Depot
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Depot Dialog */}
      <Dialog
        open={Boolean(editingDepot)}
        onOpenChange={(open, details?: any) => {
          if (!open) {
            if (
              details?.reason === "outside-press" ||
              details?.reason === "outsidePress"
            ) {
              return;
            }
            setEditingDepot(null);
          }
        }}
        disablePointerDismissal={true}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Pencil className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Edit Depot</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Update terminal name or reassign parent region.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {editingDepot && (
            <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
              {/* Region Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assigned Region *</Label>
                <Select
                  value={editRegionId}
                  onValueChange={(val) => {
                    setEditRegionId(val ?? "");
                    if (editRegionError) setEditRegionError("");
                  }}
                  items={regionItems}
                >
                  <SelectTrigger
                    className={cn(
                      "h-9 text-xs w-full",
                      editRegionError && "border-destructive focus-visible:ring-destructive/20"
                    )}
                  >
                    <SelectValue placeholder="Select parent region...">
                      {(val: string | null) => {
                        if (!val) return null;
                        return regionMap.get(val) || val;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((reg) => (
                      <SelectItem key={reg.id} value={reg.id}>
                        {reg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editRegionError && (
                  <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{editRegionError}</span>
                  </p>
                )}
              </div>

              {/* Depot Name Input */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-depot-name" className="text-xs font-semibold">
                  Depot Name *
                </Label>
                <Input
                  id="edit-depot-name"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editNameError) setEditNameError("");
                  }}
                  placeholder="e.g. Depot 28 - Hebbal"
                  className={cn(
                    "h-9 text-xs",
                    editNameError && "border-destructive focus-visible:ring-destructive/20"
                  )}
                  autoFocus
                />
                {editNameError && (
                  <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{editNameError}</span>
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingDepot(null)}
                  disabled={isUpdating}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUpdating}
                  className="text-xs font-semibold gap-1.5"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Depot Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingDepot)}
        onOpenChange={(open, details?: any) => {
          if (!open) {
            if (
              details?.reason === "outside-press" ||
              details?.reason === "outsidePress"
            ) {
              return;
            }
            setDeletingDepot(null);
          }
        }}
        disablePointerDismissal={true}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold">Delete Depot</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-1">
              {isLoadingImpact ? (
                <span className="flex items-center gap-1.5 text-muted-foreground italic">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Calculating deletion impact...
                </span>
              ) : (
                <span className="block text-destructive/90 font-medium">
                  {deleteImpactMsg ||
                    "This action cannot be undone. All routes and stops allocated to this depot will be affected."}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingDepot(null)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting || isLoadingImpact}
              className="text-xs font-semibold gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Depot
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DepotsPage;
