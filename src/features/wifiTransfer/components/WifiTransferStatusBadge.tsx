import React, { useEffect } from "react";
import { Wifi, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
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
  const { pendingPackage, openDialog, loadPendingPackage, isUploading, uploadProgress } =
    useWifiTransferStore();

  useEffect(() => {
    loadPendingPackage();
  }, [loadPendingPackage]);

  const hasPackage = Boolean(pendingPackage);

  return (
    <Button
      variant={isUploading ? "default" : hasPackage ? "default" : "outline"}
      size="sm"
      onClick={openDialog}
      className={cn(
        "h-8 text-xs font-semibold px-3 gap-2 inline-flex items-center rounded-md transition-colors cursor-pointer",
        isUploading
          ? "bg-primary text-primary-foreground shadow-xs animate-pulse"
          : hasPackage
          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      title={
        isUploading
          ? `Transfer in progress (${uploadProgress}%). Click to view details.`
          : hasPackage
          ? `Route package (${formatBytes(pendingPackage?.sizeBytes || 0)}) ready in local storage. Click to transfer to Signboard.`
          : "Open Signboard Wi-Fi Transfer panel"
      }
    >
      {isUploading ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Streaming ({uploadProgress}%)</span>
        </>
      ) : hasPackage ? (
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
