import { useState } from "react";
import { useAuthStore } from "@/core/auth/authStore";
import { isSuperAdmin } from "@/core/authorization/customerTier";
import { usePremadeAudios } from "@/features/premadeAudios/hooks/usePremadeAudios";
import { PremadeAudiosTable } from "./components/PremadeAudiosTable";
import { PremadeAudioStudioDialog } from "./components/PremadeAudioStudioDialog";
import { DeletePremadeAudioDialog } from "./components/DeletePremadeAudioDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/core/notifications/notificationService";
import type { IPremadeAudio } from "@/shared/types/premadeAudio";
import {
  Volume2,
  RefreshCw,
  Search,
  X,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

export function PremadeAudiosPage() {
  const user = useAuthStore((state) => state.user);
  const isSuper = isSuperAdmin(user);

  const {
    filteredAudios,
    isLoading,
    isDeleting,
    searchTerm,
    setSearchTerm,
    playingAudioUrl,
    playAudio,
    handleUpload,
    handleUpdate,
    handleDelete,
    refetch,
  } = usePremadeAudios();

  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [editingAudio, setEditingAudio] = useState<IPremadeAudio | null>(null);
  const [deletingAudio, setDeletingAudio] = useState<IPremadeAudio | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Super Admin security check
  if (!isSuper) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 p-12 text-center min-h-[400px]">
        <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-3">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">Access Restricted</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-md">
          The Premade Audios repository is strictly reserved for Navitronix Super Administrators (Master). You do not have permission to view or manage global audio assets.
        </p>
      </div>
    );
  }

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refetch();
      notify.success("Premade audio inventory refreshed.");
    } catch {
      notify.error("Failed to refresh audio list.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveAudio = async (
    payload: {
      referenceText: string;
      announcementText: string;
      file: File | null;
      metadata?: { language?: string; voice?: string; speed?: string };
    },
    existingAudio?: IPremadeAudio
  ) => {
    if (existingAudio) {
      await handleUpdate(
        existingAudio.id,
        {
          referenceText: payload.referenceText,
          announcementText: payload.announcementText,
          file: payload.file,
          language: payload.metadata?.language,
          voice: payload.metadata?.voice,
          speed: payload.metadata?.speed,
        },
        existingAudio
      );
    } else {
      if (!payload.file) return;
      await handleUpload(payload.file, payload.referenceText, {
        announcementText: payload.announcementText,
        ...payload.metadata,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingAudio) return;
    try {
      await handleDelete(deletingAudio);
      setDeletingAudio(null);
    } catch {
      // Error handled in hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Volume2 className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Premade Audios
            </h1>
            <Badge variant="outline" className="text-[11px] font-semibold px-2">
              Audio Inventory
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Centralized public address repository. Generate on-demand speech audio with Edge-TTS, upload master audio files, and manage transit announcements.
        </p>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by announcement text, filename, or language..."
            className="pl-9 pr-8 h-9 text-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="h-9 text-xs font-semibold gap-1.5 shadow-2xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingAudio(null);
              setIsStudioOpen(true);
            }}
            className="h-9 text-xs font-semibold gap-1.5 shadow-xs bg-primary hover:bg-primary/90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generate / Upload Audio</span>
          </Button>
        </div>
      </div>

      {/* Audios Table */}
      <PremadeAudiosTable
        audios={filteredAudios}
        isLoading={isLoading}
        playingAudioUrl={playingAudioUrl}
        onPlayAudio={playAudio}
        onEdit={(audio) => {
          setEditingAudio(audio);
          setIsStudioOpen(true);
        }}
        onDelete={(audio) => setDeletingAudio(audio)}
      />

      {/* Audio Studio Dialog (On-Demand Edge-TTS + Upload / Edit) */}
      <PremadeAudioStudioDialog
        open={isStudioOpen}
        onOpenChange={(open) => {
          setIsStudioOpen(open);
          if (!open) setEditingAudio(null);
        }}
        audio={editingAudio}
        onSave={handleSaveAudio}
      />

      {/* Delete Confirmation Modal */}
      <DeletePremadeAudioDialog
        audio={deletingAudio}
        open={Boolean(deletingAudio)}
        onOpenChange={(open) => !open && setDeletingAudio(null)}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default PremadeAudiosPage;
