import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StopAudioStudio } from "./StopAudioStudio";
import type { IStopWithAudio, IStopAudio } from "@/shared/types/stop";
import { Volume2, Loader2, Save } from "lucide-react";

export interface StopAudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: IStopWithAudio | null;
  onSave: (
    stopId: string,
    newAudioFile?: File | null,
    deleteExisting?: boolean,
    existingAudio?: { id?: string; url?: string }
  ) => Promise<void>;
}

export function StopAudioDialog({
  open,
  onOpenChange,
  stop,
  onSave,
}: StopAudioDialogProps) {
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [markedDeleteExistingAudio, setMarkedDeleteExistingAudio] = useState(false);
  const [audioFileError, setAudioFileError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Extract existing audio record
  const existingAudio: IStopAudio | null = useMemo(() => {
    if (!stop?.stop_audios) return null;
    if (Array.isArray(stop.stop_audios)) {
      return stop.stop_audios[0] || null;
    }
    return stop.stop_audios;
  }, [stop]);

  // Reset states on open/stop change
  useEffect(() => {
    if (open) {
      setSelectedAudioFile(null);
      setMarkedDeleteExistingAudio(false);
      setAudioFileError("");
      setIsSaving(false);
    }
  }, [open, stop]);

  const handleSave = async () => {
    if (!stop) return;

    // If nothing changed, just close
    if (!selectedAudioFile && !markedDeleteExistingAudio) {
      onOpenChange(false);
      return;
    }

    try {
      setIsSaving(true);
      setAudioFileError("");

      await onSave(
        stop.id,
        selectedAudioFile,
        markedDeleteExistingAudio,
        existingAudio ? { id: existingAudio.id, url: existingAudio.url } : undefined
      );

      onOpenChange(false);
    } catch (err: any) {
      console.error("[StopAudioDialog] Save error:", err);
      setAudioFileError(err?.message || "Failed to update stop audio.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!stop) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isSaving) return;
        onOpenChange(next);
      }}
      disablePointerDismissal={true}
    >
      <DialogContent className="sm:max-w-3xl p-5 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Volume2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Audio Announcement — {stop.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure and generate on-demand public address audio using Microsoft Edge-TTS or upload a custom file.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2.5">
          <StopAudioStudio
            stopName={stop.name || ""}
            existingAudio={existingAudio}
            selectedAudioFile={selectedAudioFile}
            onSelectAudioFile={setSelectedAudioFile}
            markedDeleteExistingAudio={markedDeleteExistingAudio}
            onSetMarkedDeleteExistingAudio={setMarkedDeleteExistingAudio}
            audioFileError={audioFileError}
            onSetAudioFileError={setAudioFileError}
          />
        </div>

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-end sm:justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || (!selectedAudioFile && !markedDeleteExistingAudio)}
            className="text-xs font-semibold gap-1.5 shadow-xs"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving Announcement...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save Announcement</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StopAudioDialog;
