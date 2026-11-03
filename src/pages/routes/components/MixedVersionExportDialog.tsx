import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export interface MixedVersionExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MixedVersionExportDialog({
  open,
  onOpenChange,
}: MixedVersionExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Mixed Route Versions</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cannot export V1 and V2 together
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg bg-muted/60 p-3.5 border border-border text-xs space-y-2 my-2">
          <p className="font-semibold text-foreground">
            You have selected both <strong>V1</strong> and <strong>V2</strong> routes.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Hardware export packages only support either V1 or V2 routes at one time.
            Please use the version filter tab or refine your selection to export routes of the same version.
          </p>
        </div>

        <DialogFooter className="pt-2">
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold"
          >
            Understood
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MixedVersionExportDialog;
