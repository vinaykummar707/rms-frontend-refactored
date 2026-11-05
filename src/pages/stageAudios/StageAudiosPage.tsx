import { useState } from "react";
import { useAuthStore } from "@/core/auth/authStore";
import { isSuperAdmin } from "@/core/authorization/customerTier";
import { useStageAudios } from "@/features/stageAudios/hooks/useStageAudios";
import { StageAudiosMatrixTable } from "./components/StageAudiosMatrixTable";
import { StageAudioStudioDialog } from "./components/StageAudioStudioDialog";
import { DeleteStageAudioDialog } from "./components/DeleteStageAudioDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/core/notifications/notificationService";
import {
  exportAudiosToZip,
  type IExportAudioItem,
} from "@/shared/utils/audioExport";
import type { ILanguageOption } from "@/features/stops/services/edgeTtsService";
import type { IStageAudio, StageType } from "@/shared/types/stageAudio";
import {
  Radio,
  Search,
  RefreshCw,
  ShieldAlert,
  X,
  Download,
  Loader2,
} from "lucide-react";

export function StageAudiosPage() {
  const loggedInUser = useAuthStore((state) => state.user);
  const isSuper = isSuperAdmin(loggedInUser);

  const {
    matrixRows,
    stageAudios,
    isLoading,
    refetch,
    playingAudioUrl,
    togglePlayAudio,
    handleCreate,
    handleUpdate,
    handleDelete,
  } = useStageAudios();

  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  // Dialog states
  const [studioOpen, setStudioOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<ILanguageOption | null>(null);
  const [targetStageType, setTargetStageType] = useState<StageType | null>(null);
  const [editingAudio, setEditingAudio] = useState<IStageAudio | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAudio, setDeletingAudio] = useState<IStageAudio | null>(null);

  // Trigger Add Audio
  const handleOpenAdd = (language: ILanguageOption, stageType: StageType) => {
    setEditingAudio(null);
    setTargetLanguage(language);
    setTargetStageType(stageType);
    setStudioOpen(true);
  };

  // Trigger Edit Audio
  const handleOpenEdit = (audio: IStageAudio, language: ILanguageOption) => {
    setEditingAudio(audio);
    setTargetLanguage(language);
    setTargetStageType(audio.stage_type);
    setStudioOpen(true);
  };

  // Trigger Delete Confirmation
  const handleOpenDelete = (audio: IStageAudio) => {
    setDeletingAudio(audio);
    setDeleteOpen(true);
  };

  // Studio Save / Update Handler
  const handleStudioSave = async (
    payload: {
      language: string;
      stageType: StageType;
      referenceText: string;
      announcementText: string;
      file: File | null;
      metadata?: { voice?: string; speed?: string };
    },
    existingAudio?: IStageAudio
  ) => {
    if (existingAudio) {
      await handleUpdate(
        existingAudio.id,
        {
          referenceText: payload.referenceText,
          announcementText: payload.announcementText,
          file: payload.file,
          language: payload.language,
          stageType: payload.stageType,
          voice: payload.metadata?.voice,
          speed: payload.metadata?.speed,
        },
        existingAudio
      );
    } else {
      if (!payload.file) {
        throw new Error("Audio file is required to save stage announcement.");
      }
      await handleCreate(
        payload.file,
        payload.language,
        payload.stageType,
        payload.referenceText,
        {
          announcementText: payload.announcementText,
          voice: payload.metadata?.voice,
          speed: payload.metadata?.speed,
          createdBy: loggedInUser?.user_id,
        }
      );
    }
  };

  const handleExportAudios = async () => {
    if (stageAudios.length === 0) {
      notify.info("No stage audios configured to export.");
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress("0%");

      const items: IExportAudioItem[] = stageAudios
        .filter((a) => Boolean(a.url))
        .map((a) => ({
          url: a.url,
          fileName: a.file_name,
          folder: a.language,
        }));

      const result = await exportAudiosToZip(
        items,
        `stage-audios-${Date.now()}.zip`,
        (p) => setExportProgress(`${p.percent}%`)
      );

      notify.success(`Exported ${result.count} stage audio files to ${result.zipName}`);
    } catch (err: any) {
      console.error("[StageAudiosPage] Export error:", err);
      notify.error(err.message || "Failed to export stage audios.");
    } finally {
      setIsExporting(false);
      setExportProgress("");
    }
  };

  // Guard for Super Admin
  if (!isSuper) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 p-12 text-center min-h-[400px]">
        <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-3">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">Access Restricted</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-md">
          The Stage Audios inventory is strictly reserved for Navitronix Super Administrators (Master). You do not have permission to view or manage global stage audio assets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Radio className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Stage Audios
            </h1>
            <Badge variant="outline" className="text-[11px] font-semibold px-2">
              Waypoint Announcements
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Automated waypoint stage announcement matrix (Current Stop, Next Stop, Arriving Stop) across 11 Indian languages.
        </p>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by language name or code..."
            className="pl-9 pr-8 h-9 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
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
            onClick={handleExportAudios}
            disabled={isExporting || isLoading || stageAudios.length === 0}
            className="h-9 text-xs font-semibold gap-1.5 shadow-2xs"
            title="Download all stage audios as a ZIP archive"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Exporting ({exportProgress})...</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Export Audios</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-9 text-xs font-semibold gap-1.5 shadow-2xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Language x Stage Type Matrix Table */}
      <StageAudiosMatrixTable
        rows={matrixRows}
        isLoading={isLoading}
        searchQuery={searchQuery}
        playingAudioUrl={playingAudioUrl}
        onPlay={togglePlayAudio}
        onAdd={handleOpenAdd}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
      />

      {/* Studio Modal (Single-row Edge-TTS Studio & File Upload) */}
      <StageAudioStudioDialog
        open={studioOpen}
        onOpenChange={setStudioOpen}
        targetLanguage={targetLanguage}
        targetStageType={targetStageType}
        audio={editingAudio}
        onSave={handleStudioSave}
      />

      {/* Delete Confirmation Modal */}
      <DeleteStageAudioDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        audio={deletingAudio}
        onConfirmDelete={handleDelete}
      />
    </div>
  );
}

export default StageAudiosPage;

