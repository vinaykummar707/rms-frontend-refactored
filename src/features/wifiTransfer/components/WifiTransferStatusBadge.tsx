import React, { useEffect } from "react";
import { Wifi, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWifiTransferStore } from "../stores/useWifiTransferStore";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const WifiTransferStatusBadge: React.FC<{ className?: string }> = ({
  className,
}) => {
  const { pendingPackage, openDialog, loadPendingPackage } = useWifiTransferStore();

  useEffect(() => {
    loadPendingPackage();
  }, [loadPendingPackage]);

  const hasPackage = Boolean(pendingPackage);

  return (
    <Button
      variant={hasPackage ? "default" : "outline"}
      size="sm"
      onClick={openDialog}
      className={`h-8 text-xs font-semibold px-3 gap-2 inline-flex items-center rounded-md transition-colors cursor-pointer ${
        hasPackage
          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          : "text-muted-foreground hover:text-foreground"
      } ${className || ""}`}
      title={
        hasPackage
          ? `ZIP package (${formatBytes(pendingPackage?.sizeBytes || 0)}) stored locally. Click to upload to Signboard.`
          : "Open Signboard Wi-Fi Transfer panel"
      }
    >
      {hasPackage ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <Radio className="h-3.5 w-3.5" />
          <span>Signboard Ready ({formatBytes(pendingPackage?.sizeBytes || 0)})</span>
        </>
      ) : (
        <>
          <Wifi className="h-3.5 w-3.5" />
          <span>Wi-Fi Transfer</span>
        </>
      )}
    </Button>
  );
};

