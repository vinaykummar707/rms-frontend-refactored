import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import type { IStopWithAudio } from "@/shared/types/stop";

interface DeleteStopDialogProps {
  stop: IStopWithAudio | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function DeleteStopDialog({
  stop,
  open,
  onOpenChange,
  isDeleting,
  onConfirm,
}: DeleteStopDialogProps) {
  if (!stop) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isDeleting) return;
        onOpenChange(next);
      }}
      disablePointerDismissal={true}
    >
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle className="text-base font-bold">
            Delete Stop
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-1">
            <span>
              This action cannot be undone. Are you sure you want to permanently delete stop{" "}
              <strong className="text-foreground">"{stop.name}"</strong>?
              This will also remove any associated public address audio files.
            </span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-4 border-t border-border">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
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
                Delete Stop
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

