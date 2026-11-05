import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { cn } from "cn";
import { useOrganizationStore } from "@/features/stores/useOrganizationStore";
import { useRegionStore } from "@/features/stores/useRegionStore";
import { useDepotStore } from "@/features/stores/useDepotStore";
import { useAuthStore } from "@/core/auth/authStore";
import { regionCrud } from "@/features/regions/api/regionCrud";
import { depotCrud } from "@/features/depots/api/depotCrud";
import { useStops } from "@/features/stops/hooks/useStops";
import { notify } from "@/core/notifications/notificationService";
import type { IRegion } from "@/shared/types/region";
import type { IDepot } from "@/shared/types/depot";
import type { IStopWithAudio, IStopCreate, IStopUpdate } from "@/shared/types/stop";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { StopsTable } from "./components/StopsTable";
import { StopDialog } from "./components/StopDialog";
import { StopAudioDialog } from "./components/StopAudioDialog";
import { DeleteSelectedStopsDialog } from "./components/DeleteSelectedStopsDialog";
import { DeleteStopDialog } from "./components/DeleteStopDialog";
import {
  exportAudiosToZip,
  type IExportAudioItem,
} from "@/shared/utils/audioExport";
import {
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Warehouse,
  Building2,
  Box,
  Map as MapIcon,
  X,
  Search,
  Download,
  Loader2,
} from "lucide-react";

export function StopsPage() {
  const user = useAuthStore((state) => state.user);
  const { selectedOrganization } = useOrganizationStore();
  const { selectedDepot, setSelectedDepot } = useDepotStore();
  const selectedRegion = useRegionStore((state) => state.selectedRegion);
  const setSelectedRegionInStore = useRegionStore((state) => state.setSelectedRegion);

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

  const userRegionId = user?.region?.id || (user as any)?.region_id;
  const userDepotId = user?.depot?.id || (user as any)?.depot_id;

  // Dialog & Selection States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<IStopWithAudio | null>(null);
  const [audioDialogStop, setAudioDialogStop] = useState<IStopWithAudio | null>(null);
  const [deletingStop, setDeletingStop] = useState<IStopWithAudio | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingAudios, setIsExportingAudios] = useState(false);
  const [exportAudiosProgress, setExportAudiosProgress] = useState("");

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  // Fetch Regions for this organization
  const {
    data: regionData,
    isLoading: isRegionsLoading,
    refetch: refetchRegions,
  } = regionCrud.useList({
    filters: {
      organization_id: activeOrgId || "",
    },
    orderBy: { column: "created_at", ascending: true },
    skip: !activeOrgId,
  });

  // Fetch Depots for selected region
  const {
    data: depotData,
    isLoading: isDepotsLoading,
    refetch: refetchDepots,
  } = depotCrud.useList({
    filters: {
      region_id: selectedRegion?.id || "",
    },
    orderBy: { column: "created_at", ascending: true },
    skip: !selectedRegion?.id,
  });

  const regions = useMemo(
    () => (regionData?.data as IRegion[]) || [],
    [regionData]
  );
  const depots = useMemo(
    () => (depotData?.data as IDepot[]) || [],
    [depotData]
  );

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

  const hasRegions = regions.length > 0;
  const hasDepots = depots.length > 0;

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
        setSelectedRegionInStore(null);
      }
      return;
    }

    if (isRegionOrDepotAdmin && userRegionId) {
      const assigned =
        regions.find((r) => r.id === userRegionId) || user?.region || null;
      if (assigned && selectedRegion?.id !== userRegionId) {
        setSelectedRegionInStore(assigned as any);
        return;
      }
    }

    const isSelectedRegionValid = regions.some(
      (region) => region.id === selectedRegion?.id
    );

    if (!isSelectedRegionValid && regions.length > 0) {
      setSelectedRegionInStore(regions[0] || null);
    }
  }, [regions, regionData, selectedRegion, setSelectedRegionInStore, isRegionOrDepotAdmin, user, userRegionId]);

  // Auto-select or validate Depot
  useEffect(() => {
    if (!depotData) return;

    if (depots.length === 0) {
      if (selectedDepot) {
        setSelectedDepot(null);
      }
      return;
    }

    if (isDepotAdmin && userDepotId) {
      const assigned =
        depots.find((d) => d.id === userDepotId) || user?.depot || null;
      if (assigned && selectedDepot?.id !== userDepotId) {
        setSelectedDepot(assigned as any);
        return;
      }
    }

    const isSelectedDepotValid = depots.some((d) => d.id === selectedDepot?.id);

    if (!isSelectedDepotValid && depots.length > 0) {
      setSelectedDepot(depots[0] || null);
    }
  }, [depots, depotData, selectedDepot, setSelectedDepot, isDepotAdmin, user, userDepotId]);

  // ─── Stops Hook ─────────────────────────────────────────────────────────────
  const {
    stops,
    filteredStops,
    isLoading: isStopsLoading,
    searchTerm,
    setSearchTerm,
    playingAudioUrl,
    uploadingStopId,
    generatingStopId,
    playAudio,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleDeleteAudio,
    handleUploadAudio,
    handleDeleteSelected,
    refetch: refetchStops,
  } = useStops(selectedDepot?.id, activeOrgId);

  // Clear selections when depot or search changes
  useEffect(() => {
    setSelectedStopIds([]);
  }, [selectedDepot?.id, searchTerm]);

  // Handle Refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([refetchRegions(), refetchDepots(), refetchStops()]);
      notify.success("Stops refreshed successfully");
    } catch {
      notify.error("Failed to refresh stops");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRegionChange = (val: string | null) => {
    if (!val) return;
    const match = regions.find((r) => r.id === val) || null;
    setSelectedRegionInStore(match);
  };

  const handleDepotChange = (val: string | null) => {
    if (!val) return;
    const match = depots.find((d) => d.id === val) || null;
    setSelectedDepot(match);
  };

  // Multi-stop Selection Handlers
  const handleSelectedChange = (stopId: string, selected: boolean) => {
    setSelectedStopIds((prev) =>
      selected ? [...prev, stopId] : prev.filter((id) => id !== stopId)
    );
  };

  const handleSelectAllChange = (checked: boolean) => {
    if (checked && filteredStops.length > 0) {
      setSelectedStopIds(filteredStops.map((s) => s.id));
    } else {
      setSelectedStopIds([]);
    }
  };

  // Confirm Bulk Delete Selected Stops
  const onConfirmBulkDelete = async () => {
    if (selectedStopIds.length === 0) return;
    try {
      setIsDeletingBulk(true);
      await handleDeleteSelected(selectedStopIds);
      setSelectedStopIds([]);
      setIsBulkDeleteOpen(false);
    } catch {
      // Notification handled in hook
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Single Stop Delete
  const handleConfirmSingleDelete = async () => {
    if (!deletingStop) return;
    try {
      setIsDeletingSingle(true);
      await handleDelete(deletingStop);
      setSelectedStopIds((prev) => prev.filter((id) => id !== deletingStop.id));
      setDeletingStop(null);
    } catch {
      // Notification handled in hook
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Audio Studio Dialog Save Handler
  const handleSaveAudioDialog = async (
    _stopId: string,
    newAudioFile?: File | null,
    deleteExisting?: boolean
  ) => {
    if (!audioDialogStop) return;
    if (newAudioFile) {
      await handleUploadAudio(audioDialogStop, newAudioFile);
    } else if (deleteExisting) {
      await handleDeleteAudio(audioDialogStop);
    }
  };

  const stopsWithAudioCount = useMemo(() => {
    return stops.filter((s) => {
      const audio = Array.isArray(s.stop_audios) ? s.stop_audios[0] : s.stop_audios;
      return Boolean(audio && audio.url);
    }).length;
  }, [stops]);

  const handleExportStopAudios = async () => {
    const stopsWithAudio = stops.filter((s) => {
      const audio = Array.isArray(s.stop_audios) ? s.stop_audios[0] : s.stop_audios;
      return Boolean(audio && audio.url);
    });

    if (stopsWithAudio.length === 0) {
      notify.info("No stop audio recordings available to export.");
      return;
    }

    try {
      setIsExportingAudios(true);
      setExportAudiosProgress("0%");

      const items: IExportAudioItem[] = stopsWithAudio.map((s) => {
        const audio = Array.isArray(s.stop_audios) ? s.stop_audios[0] : s.stop_audios!;
        const ext = audio.file_name?.split(".").pop() || "mp3";
        const cleanStopName = s.name
          .trim()
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-");
        return {
          url: audio.url,
          fileName: `${cleanStopName || "stop"}.${ext}`,
        };
      });

      const depotSlug = selectedDepot?.name
        ? `${selectedDepot.name.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")}-`
        : "";

      const result = await exportAudiosToZip(
        items,
        `${depotSlug}stop-audios-${Date.now()}.zip`,
        (p) => setExportAudiosProgress(`${p.percent}%`)
      );

      notify.success(`Exported ${result.count} stop audio files to ${result.zipName}`);
    } catch (err: any) {
      console.error("[StopsPage] Export audios error:", err);
      notify.error(err.message || "Failed to export stop audios.");
    } finally {
      setIsExportingAudios(false);
      setExportAudiosProgress("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Stops
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage transit stops, coordinate waypoints, and audio announcements for{" "}
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
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left Side: Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-3xl flex-wrap">
          {/* Search Input */}
          <div className="min-w-[220px]">
            <Field>
              <FieldLabel>Search</FieldLabel>
              <div className="relative">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by stop name or coordinates..."
                  className="pl-9 pr-8 h-9 text-xs"
                />
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
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
            </Field>
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

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Export Audios Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportStopAudios}
            disabled={isExportingAudios || isRefreshing || stopsWithAudioCount === 0}
            className="h-9 gap-1.5 text-xs font-semibold shadow-2xs"
            title={
              stopsWithAudioCount === 0
                ? "No stop audio recordings available to export"
                : "Download all stop audio files for this depot as a ZIP archive"
            }
          >
            {isExportingAudios ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Exporting ({exportAudiosProgress})...</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Export Audios ({stopsWithAudioCount})</span>
              </>
            )}
          </Button>

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

          {/* Add Stop Button */}
          {canManage && !isGuest && (
            <Button
              size="sm"
              onClick={() => {
                setEditingStop(null);
                setIsFormOpen(true);
              }}
              disabled={!selectedDepot}
              className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
              title={!selectedDepot ? "Select a depot first" : undefined}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Stop</span>
            </Button>
          )}

          {/* Bulk Action Buttons (When rows are selected) */}
          {selectedStopIds.length > 0 && canManage && !isGuest && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsBulkDeleteOpen(true)}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete ({selectedStopIds.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Meta Bar: Record Count & Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-foreground">{filteredStops.length}</strong> of{" "}
            <strong className="text-foreground">{stops.length}</strong> records
          </span>

          {selectedStopIds.length > 0 && (
            <Badge variant="secondary" className="text-[11px] h-5 font-medium">
              {selectedStopIds.length} selected
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!activeOrgId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Organization Selected
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Please choose an active organization from the top bar selector to manage its transit stops.
          </p>
        </div>
      ) : regions.length === 0 && !isRegionsLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
            <Box className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Administrative Regions Found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Stops belong to operational depots inside administrative regions.
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
            <Warehouse className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Depots Found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            No operational depots have been created for {selectedRegion?.name || "this region"}.
            Stops must belong to a depot facility.
          </p>
          <Link to="/home/depots">
            <Button size="sm" className="mt-4 text-xs font-semibold gap-1.5 shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Configure Depots First</span>
            </Button>
          </Link>
        </div>
      ) : !selectedDepot ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Warehouse className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No Depot Selected</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Please choose a region and depot from the dropdowns above to manage its transit stops and audio announcements.
          </p>
        </div>
      ) : stops.length === 0 && !isStopsLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <MapPin className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Transit Stops Found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            No transit stops have been configured for{" "}
            <strong className="text-foreground">{selectedDepot.name}</strong> yet.
            Create your first stop to set up coordinates and announcement audio.
          </p>
          {canManage && !isGuest && (
            <Button
              size="sm"
              onClick={() => {
                setEditingStop(null);
                setIsFormOpen(true);
              }}
              className="mt-4 text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Stop</span>
            </Button>
          )}
        </div>
      ) : (
        <StopsTable
          stops={filteredStops}
          selectedStopIds={selectedStopIds}
          onSelectedChange={handleSelectedChange}
          onSelectAllChange={handleSelectAllChange}
          isLoading={isStopsLoading}
          uploadingStopId={uploadingStopId}
          generatingStopId={generatingStopId}
          playingAudioUrl={playingAudioUrl}
          onPlayAudio={playAudio}
          onUploadAudio={handleUploadAudio}
          onDeleteAudio={handleDeleteAudio}
          onGenerateAudio={(stop) => {
            setAudioDialogStop(stop);
          }}
          onEdit={(stop) => {
            setEditingStop(stop);
            setIsFormOpen(true);
          }}
          onDelete={(stop) => {
            setDeletingStop(stop);
          }}
          isGuest={isGuest}
        />
      )}

      {/* Dedicated Edge-TTS & Audio Announcement Studio Dialog */}
      <StopAudioDialog
        open={Boolean(audioDialogStop)}
        onOpenChange={(open) => !open && setAudioDialogStop(null)}
        stop={audioDialogStop}
        onSave={handleSaveAudioDialog}
      />

      {/* Create / Edit Stop Dialog */}
      {selectedDepot && activeOrgId && (
        <StopDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          stop={editingStop}
          depotId={selectedDepot.id}
          organizationId={activeOrgId}
          onSave={async (payload, audioFile, deleteExistingAudio, existingAudio) => {
            if (editingStop) {
              await handleUpdate(
                editingStop.id,
                payload as IStopUpdate,
                audioFile,
                deleteExistingAudio,
                existingAudio
              );
            } else {
              await handleCreate(payload as IStopCreate, audioFile);
            }
          }}
        />
      )}

      {/* Delete Single Stop Confirmation Modal */}
      <DeleteStopDialog
        stop={deletingStop}
        open={Boolean(deletingStop)}
        onOpenChange={(open) => !open && setDeletingStop(null)}
        isDeleting={isDeletingSingle}
        onConfirm={handleConfirmSingleDelete}
      />

      {/* Delete Selected Stops Confirmation Modal */}
      <DeleteSelectedStopsDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        depotName={selectedDepot?.name}
        selectedCount={selectedStopIds.length}
        isDeleting={isDeletingBulk}
        onConfirm={onConfirmBulkDelete}
      />
    </div>
  );
}

export default StopsPage;
