import React, { useState, useMemo } from "react";
import { cn } from "cn";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationStore } from "@/features/stores/useOrganizationStore";
import { useRegionStore } from "@/features/stores/useRegionStore";
import { useAuthStore } from "@/core/auth/authStore";
import { regionCrud } from "@/features/regions/api/regionCrud";
import {
  checkRegionNameDuplicate,
  getRegionDeleteImpactMessage,
} from "@/features/regions/services/regionService";
import { formatDate, sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import type { IRegion } from "@/shared/types/region";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Box,
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
  Warehouse,
} from "lucide-react";

export function RegionsPage() {
  const user = useAuthStore((state) => state.user);
  const { selectedOrganization } = useOrganizationStore();
  const { selectedRegion, setSelectedRegion } = useRegionStore();

  const activeOrgId =
    selectedOrganization?.id || user?.organization_id || user?.organization?.id;
  const activeOrgName =
    selectedOrganization?.name || user?.organization?.name || "Organization";

  const userRole = user?.role?.name?.toLowerCase() || "";
  const canManage = userRole === "organization_admin" || userRole === "master";

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createNameError, setCreateNameError] = useState("");

  const [editingRegion, setEditingRegion] = useState<IRegion | null>(null);
  const [editName, setEditName] = useState("");
  const [editNameError, setEditNameError] = useState("");

  const [deletingRegion, setDeletingRegion] = useState<IRegion | null>(null);
  const [deleteImpactMsg, setDeleteImpactMsg] = useState("");
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);

  // CRUD API Hooks
  const { useList, useCreate, useUpdate, useDelete } = regionCrud;

  const {
    data: regionsData,
    isLoading: isRegionsLoading,
    isError,
    refetch: refetchRegions,
  } = useList({
    filters: { organization_id: activeOrgId || "" },
    orderBy: { column: "created_at", ascending: false },
    skip: !activeOrgId,
  });

  const { mutateAsync: createRegion, isPending: isCreating } = useCreate();
  const { mutateAsync: updateRegion, isPending: isUpdating } = useUpdate();
  const { mutateAsync: deleteRegion, isPending: isDeleting } = useDelete();

  // Query Depots to calculate live depot count per region
  const { data: depotsData, refetch: refetchDepots } = useQuery({
    queryKey: ["regions-depots-count", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];
      const { data, error } = await supabase
        .from("depots")
        .select("id, region_id")
        .eq("organization_id", activeOrgId);
      if (error) {
        console.warn("Failed to fetch depots count for regions:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const depotsByRegion = useMemo(() => {
    const map = new Map<string, number>();
    (depotsData || []).forEach((d) => {
      if (d.region_id) {
        map.set(d.region_id, (map.get(d.region_id) || 0) + 1);
      }
    });
    return map;
  }, [depotsData]);

  // Sorted and filtered regions
  const rawRegions = useMemo(() => {
    const list = (regionsData?.data as IRegion[]) || [];
    return sortByLatestCreated(list);
  }, [regionsData]);

  const filteredRegions = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return rawRegions;
    return rawRegions.filter((r) => r.name?.toLowerCase().includes(search));
  }, [rawRegions, searchTerm]);

  // Handle Refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([refetchRegions(), refetchDepots()]);
      notify.info("Region list refreshed");
    } finally {
      setIsRefreshing(false);
    }
  };

  // ----------------------------------------------------
  // Create Region
  // ----------------------------------------------------
  const handleOpenCreate = () => {
    setCreateName("");
    setCreateNameError("");
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) {
      notify.error("No active organization selected");
      return;
    }

    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateNameError("Region name is required.");
      return;
    }
    if (trimmed.length < 2) {
      setCreateNameError("Region name must be at least 2 characters.");
      return;
    }

    try {
      const isDuplicate = await checkRegionNameDuplicate(trimmed, activeOrgId);
      if (isDuplicate) {
        setCreateNameError(`Region "${trimmed}" already exists in this organization.`);
        return;
      }

      await createRegion({
        name: trimmed,
        organization_id: activeOrgId,
      });

      notify.success("Region created successfully", `"${trimmed}" is now available.`);
      setIsCreateOpen(false);
      refetchRegions();
    } catch (err: any) {
      notify.error(err.message || "Failed to create region");
    }
  };

  // ----------------------------------------------------
  // Edit Region
  // ----------------------------------------------------
  const handleOpenEdit = (region: IRegion) => {
    setEditingRegion(region);
    setEditName(region.name || "");
    setEditNameError("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegion || !activeOrgId) return;

    const trimmed = editName.trim();
    if (!trimmed) {
      setEditNameError("Region name is required.");
      return;
    }
    if (trimmed.length < 2) {
      setEditNameError("Region name must be at least 2 characters.");
      return;
    }

    try {
      const isDuplicate = await checkRegionNameDuplicate(
        trimmed,
        activeOrgId,
        editingRegion.id
      );
      if (isDuplicate) {
        setEditNameError(`Region "${trimmed}" already exists in this organization.`);
        return;
      }

      await updateRegion({
        id: editingRegion.id,
        payload: {
          id: editingRegion.id,
          name: trimmed,
          organization_id: editingRegion.organization_id,
        },
      });

      notify.success("Region updated successfully", `Renamed to "${trimmed}".`);
      setEditingRegion(null);
      refetchRegions();
    } catch (err: any) {
      notify.error(err.message || "Failed to update region");
    }
  };

  // ----------------------------------------------------
  // Delete Region
  // ----------------------------------------------------
  const handlePromptDelete = async (region: IRegion) => {
    setDeletingRegion(region);
    setDeleteImpactMsg("");
    setIsLoadingImpact(true);
    try {
      const msg = await getRegionDeleteImpactMessage(region.id);
      setDeleteImpactMsg(msg);
    } catch {
      setDeleteImpactMsg(
        "Deleting this region will permanently delete all child depots, routes, and stops."
      );
    } finally {
      setIsLoadingImpact(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRegion) return;

    try {
      await deleteRegion(deletingRegion.id);

      if (selectedRegion && selectedRegion.id === deletingRegion.id) {
        setSelectedRegion(null);
      }

      notify.success("Region deleted successfully", `Removed "${deletingRegion.name}".`);
      setDeletingRegion(null);
      refetchRegions();
      refetchDepots();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete region");
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Regions
          </h1>
          <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5">
            {filteredRegions.length} Total
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage administrative territories and operating divisions for{" "}
          <strong className="text-foreground">{activeOrgName}</strong>.
        </p>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search regions by name..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Region</span>
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

      {/* No Active Organization Selected (Super-admin state) */}
      {!activeOrgId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Organization Selected
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Please choose an active organization from the top bar selector to manage its administrative regions.
          </p>
        </div>
      ) : isRegionsLoading ? (
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
            Failed to load regions. Please check your network connection.
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
      ) : filteredRegions.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Box className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No regions found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {searchTerm
              ? `No regions match "${searchTerm}".`
              : "No administrative divisions have been configured for this organization yet."}
          </p>
          {searchTerm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="mt-4 text-xs"
            >
              Clear Search
            </Button>
          ) : (
            canManage && (
              <Button
                size="sm"
                onClick={handleOpenCreate}
                className="mt-4 text-xs font-semibold gap-1.5 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Region</span>
              </Button>
            )
          )}
        </div>
      ) : (
        /* Regions Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {filteredRegions.map((region) => {
            const initials = region.name.slice(0, 2).toUpperCase();
            const depotCount = depotsByRegion.get(region.id) || 0;

            return (
              <Card
                key={region.id}
                className="relative flex flex-col justify-between transition-all duration-200 border-border/80 bg-card hover:border-foreground/20 hover:shadow-md"
              >
                <div>
                  {/* Card Header */}
                  <CardHeader className=" pb-2.5 block w-full min-w-0">
                    <div className="flex items-start justify-between gap-2 w-full min-w-0">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <Avatar className="h-9 w-9 rounded-xl after:rounded-xl shrink-0 mt-0.5">
                          <AvatarFallback className="rounded-xl text-xs font-bold text-white bg-blue-600 shadow-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                       
                      </div>

                      {/* Depots Count Badge */}
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0.5 gap-1 shrink-0 font-medium"
                      >
                        <Warehouse className="h-2.5 w-2.5 text-muted-foreground" />
                        <span>{depotCount} Depots</span>
                      </Badge>
                    </div>
                  </CardHeader>

                  {/* Card Content */}
                  <CardContent className=" pt-0 space-y-2">
                     <div className="min-w-0 flex-1">
                          <CardTitle
                            className="text-sm font-semibold leading-snug text-foreground line-clamp-2 break-words [overflow-wrap:anywhere]"
                            title={region.name}
                          >
                            {region.name}
                          </CardTitle>
                        </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3 border-t border-border/60">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      <span>Created {formatDate(region.created_at)}</span>
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer */}
                {canManage && (
                  <CardFooter className="px-3.5 py-2.5 border-t border-border/80 flex items-center justify-end gap-1.5 bg-muted/20">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(region)}
                      className="h-7 text-xs px-2.5 gap-1 hover:bg-muted font-medium"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePromptDelete(region)}
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

      {/* Create Region Dialog */}
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
                <DialogTitle className="text-base font-bold">Create Region</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Add an administrative division to {activeOrgName}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-region-name" className="text-xs font-semibold">
                Region Name *
              </Label>
              <Input
                id="create-region-name"
                value={createName}
                onChange={(e) => {
                  setCreateName(e.target.value);
                  if (createNameError) setCreateNameError("");
                }}
                placeholder="e.g. Bangalore Central Division"
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

            <DialogFooter className="pt-3 border-t border-border">
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
                    Create Region
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Region Dialog */}
      <Dialog
        open={Boolean(editingRegion)}
        onOpenChange={(open, details?: any) => {
          if (!open) {
            if (
              details?.reason === "outside-press" ||
              details?.reason === "outsidePress"
            ) {
              return;
            }
            setEditingRegion(null);
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
                <DialogTitle className="text-base font-bold">Edit Region</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Update administrative division parameters.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {editingRegion && (
            <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-region-name" className="text-xs font-semibold">
                  Region Name *
                </Label>
                <Input
                  id="edit-region-name"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editNameError) setEditNameError("");
                  }}
                  placeholder="e.g. Bangalore Central Division"
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

              <DialogFooter className="pt-3 border-t border-border">
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

      {/* Delete Region Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingRegion)}
        onOpenChange={(open, details?: any) => {
          if (!open) {
            if (
              details?.reason === "outside-press" ||
              details?.reason === "outsidePress"
            ) {
              return;
            }
            setDeletingRegion(null);
          }
        }}
        disablePointerDismissal={true}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold">Delete Region</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-1">
              {isLoadingImpact ? (
                <span className="flex items-center gap-1.5 text-muted-foreground italic">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Calculating deletion impact...
                </span>
              ) : (
                <span className="block text-destructive/90 font-medium">
                  {deleteImpactMsg ||
                    "This action cannot be undone. All child depots, routes, and stops associated with this region will be detached or deleted."}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4 border-t border-border">
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
                  Delete Region
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RegionsPage;

