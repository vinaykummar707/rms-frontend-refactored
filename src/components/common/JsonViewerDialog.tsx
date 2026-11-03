import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code2 } from "lucide-react";
import { notify } from "@/core/notifications/notificationService";

interface JsonViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  data: any;
}

export const JsonViewerDialog: React.FC<JsonViewerDialogProps> = ({
  open,
  onOpenChange,
  title = "Route Configuration JSON",
  data,
}) => {
  const [copied, setCopied] = useState(false);

  const formattedJson = React.useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    notify.success("JSON copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] p-0 gap-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-primary" />
              <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Raw route configuration payload inspected for simulator and hardware export.
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 gap-1.5 text-xs mr-6 font-medium"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy JSON</span>
              </>
            )}
          </Button>
        </DialogHeader>

        <div className="p-4 max-h-[500px] overflow-auto bg-muted/30 font-mono text-xs">
          <pre className="text-foreground whitespace-pre-wrap break-all select-all">
            {formattedJson}
          </pre>
        </div>

        <DialogFooter className="p-3 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JsonViewerDialog;

