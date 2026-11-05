import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { IStageAudio } from "@/shared/types/stageAudio";
import { STAGE_TYPES } from "@/shared/types/stageAudio";
import {
  AlertTriangle,
  Play,
  Pause,
  Trash2,
  Loader2,
  FileAudio,
} from "lucide-react";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface DeleteStageAudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audio: IStageAudio | null;
  onConfirmDelete: (audio: IStageAudio) => Promise<void>;
}

export function DeleteStageAudioDialog({
  open,
  onOpenChange,
  audio,
  onConfirmDelete,
}: DeleteStageAudioDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      setIsDeleting(false);
    }
  }, [open]);

  if (!audio) return null;

  const stageMeta = STAGE_TYPES.find((s) => s.type === audio.stage_type);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audio.url);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = audio.url;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onConfirmDelete(audio);
      onOpenChange(false);
    } catch (err) {
      console.error("[DeleteStageAudioDialog] Error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isDeleting) return;
        onOpenChange(next);
      }}
      disablePointerDismissal={true}
    >
      <DialogContent className="sm:max-w-md p-5">
        <DialogHeader className="pb-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-destructive">
                Delete Stage Audio
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                This action permanently removes the audio file from Supabase storage and inventory.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2.5 text-xs">
          {/* Audio Info Card */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground text-sm">
                {audio.reference_text}
              </span>
              <Badge variant="outline" className={stageMeta?.color || ""}>
                {stageMeta?.label || audio.stage_type}
              </Badge>
            </div>

            {audio.announcement_text && (
              <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-2 rounded border border-border/40">
                "{audio.announcement_text}"
              </p>
            )}

            <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <FileAudio className="h-3.5 w-3.5" />
                <span className="font-mono">{audio.file_name}</span>
              </div>
              <span>{formatFileSize(audio.file_size)}</span>
            </div>
          </div>

          {/* Quick Playback Preview */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-2 px-3">
            <span className="text-muted-foreground">Preview audio before deleting:</span>
            <Button
              type="button"
              variant={isPlaying ? "default" : "outline"}
              size="sm"
              onClick={togglePlay}
              className="h-7 text-xs px-2.5 gap-1.5"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3 w-3" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  <span>Play</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Footer strictly with ZERO Cancel button */}
        <DialogFooter className="pt-2 border-t border-border flex justify-end">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-8 text-xs font-semibold gap-1.5 px-4 shadow-xs"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Permanently</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteStageAudioDialog;
