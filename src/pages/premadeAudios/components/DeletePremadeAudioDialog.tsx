import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { IPremadeAudio } from "@/shared/types/premadeAudio";
import { AlertTriangle, Loader2, Trash2, FileAudio } from "lucide-react";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface DeletePremadeAudioDialogProps {
  audio: IPremadeAudio | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDeleting: boolean;
  onConfirm: () => Promise<void>;
}

export function DeletePremadeAudioDialog({
  audio,
  open,
  onOpenChange,
  isDeleting,
  onConfirm,
}: DeletePremadeAudioDialogProps) {
  if (!audio) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-destructive">
                Delete Premade Audio
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                This action is permanent and cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <p className="text-muted-foreground">
            Are you sure you want to delete this audio asset? It will be permanently removed from Supabase storage and inventory:
          </p>

          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
            <div className="font-semibold text-foreground text-sm flex items-start gap-1.5">
              <FileAudio className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="line-clamp-2">"{audio.reference_text}"</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{audio.file_name}</span>
              <span>•</span>
              <span>{formatFileSize(audio.file_size)}</span>
              {audio.language && (
                <>
                  <span>•</span>
                  <span className="uppercase">{audio.language}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-end sm:justify-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-xs font-semibold gap-1.5 shadow-xs"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Deleting Audio...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Audio</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeletePremadeAudioDialog;

