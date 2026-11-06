import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Wifi,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  RefreshCw,
  HardDrive,
  Cpu,
} from "lucide-react";
import { saveAs } from "file-saver";
import { useWifiTransferStore } from "../stores/useWifiTransferStore";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const WifiTransferDialog: React.FC = () => {
  const {
    isDialogOpen,
    closeDialog,
    pendingPackage,
    hardwareIp,
    setHardwareIp,
    hardwareStatus,
    isCheckingStatus,
    statusError,
    checkStatus,
    isUploading,
    uploadProgress,
    uploadBytesLoaded,
    uploadBytesTotal,
    uploadSuccess,
    uploadError,
    startUpload,
    discardPackage,
    resetUploadState,
  } = useWifiTransferStore();

  const [inputIp, setInputIp] = useState<string>(hardwareIp);

  const handleIpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputIp(e.target.value);
  };

  const handleIpBlur = () => {
    setHardwareIp(inputIp);
  };

  const handlePing = () => {
    setHardwareIp(inputIp);
    checkStatus();
  };

  const handleDownloadBackup = () => {
    if (pendingPackage) {
      saveAs(pendingPackage.blob, pendingPackage.filename);
    }
  };

  const handleStartUpload = async () => {
    await startUpload();
  };

  const handleClose = () => {
    resetUploadState();
    closeDialog();
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Wifi className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Signboard Wi-Fi Transfer</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Transfer route packages directly to the signboard microcontroller via its Wi-Fi hotspot.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Step 1: Pending Package Overview */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Offline Package Status
                </span>
              </div>
              {pendingPackage ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Ready in Local Storage
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground">
                  No Pending Package
                </span>
              )}
            </div>

            {pendingPackage ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-[10px] text-muted-foreground block">Format</span>
                    <span className="font-semibold uppercase">{pendingPackage.format}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-[10px] text-muted-foreground block">Routes</span>
                    <span className="font-semibold">{pendingPackage.routeCount} route(s)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-[10px] text-muted-foreground block">Size</span>
                    <span className="font-semibold font-mono">{formatBytes(pendingPackage.sizeBytes)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-[10px] text-muted-foreground block">Exported</span>
                    <span className="font-semibold text-[11px]">
                      {new Date(pendingPackage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground truncate max-w-[240px]" title={pendingPackage.filename}>
                    {pendingPackage.filename}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadBackup}
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                      title="Save a backup copy to your computer"
                    >
                      <Download className="h-3 w-3 mr-1" /> Backup PC Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={discardPackage}
                      disabled={isUploading}
                      className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                      title="Clear this package from offline storage"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Discard
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2 text-xs text-muted-foreground">
                No routes package is currently queued. Export routes from the Routes page to store a package here for Wi-Fi transfer.
              </div>
            )}
          </div>

          {/* Step 2: Microcontroller Connection Setup */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Signboard Hardware Connection
                </span>
              </div>
              {hardwareStatus ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Signboard Connected
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Not Connected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  value={inputIp}
                  onChange={handleIpChange}
                  onBlur={handleIpBlur}
                  placeholder="192.168.4.1"
                  className="h-8 text-xs font-mono"
                  disabled={isUploading}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePing}
                disabled={isCheckingStatus || isUploading}
                className="h-8 text-xs font-medium px-3 shrink-0"
              >
                <RefreshCw className={`h-3 w-3 mr-1.5 ${isCheckingStatus ? "animate-spin" : ""}`} />
                Test Connection
              </Button>
            </div>

            {/* Hardware Status Details */}
            {hardwareStatus && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">Device ID</span>
                  <span className="font-semibold truncate">{hardwareStatus.device_id}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">Wi-Fi Status</span>
                  <span className="font-semibold capitalize">{hardwareStatus.wifi_status}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">Firmware</span>
                  <span className="font-semibold">{hardwareStatus.frimware}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">STM32 Driver</span>
                  <span className="font-semibold capitalize">{hardwareStatus.stm32_status}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">Transfer Status</span>
                  <span className="font-semibold capitalize">{hardwareStatus.transfer_status}</span>
                </div>
              </div>
            )}

            {/* Status Error Notice */}
            {statusError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Hardware unreachable</span>
                  <span>{statusError}</span>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Connect your device to the Signboard's Wi-Fi hotspot in your network settings, then click Test Connection.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Upload Progress & Feedback */}
          {isUploading && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-primary flex items-center gap-1.5">
                  <UploadCloud className="h-4 w-4 animate-bounce" /> Uploading to Signboard...
                </span>
                <span className="font-mono font-bold text-primary">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{formatBytes(uploadBytesLoaded)} sent</span>
                <span>Total {formatBytes(uploadBytesTotal)}</span>
              </div>
            </div>
          )}

          {/* Success State */}
          {uploadSuccess && (
            <div className="flex items-start gap-2.5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <span className="font-bold text-sm block">Upload Succeeded!</span>
                <p className="mt-0.5">
                  The route package has been transferred and confirmed by the microcontroller. Offline storage has been cleared.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {uploadError && !isUploading && (
            <div className="flex items-start gap-2.5 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Upload Failed</span>
                <p>{uploadError}</p>
              </div>
            </div>
          )}

          {/* Actions Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            {uploadError && !isUploading && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartUpload}
                disabled={!pendingPackage}
                className="h-8 text-xs font-semibold px-4 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" /> Retry Upload
              </Button>
            )}

            {!uploadSuccess ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleStartUpload}
                disabled={!pendingPackage || isUploading}
                className="h-8 text-xs font-semibold px-4 cursor-pointer"
              >
                <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                {isUploading ? `Uploading (${uploadProgress}%)` : "Upload to Signboard"}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleClose}
                className="h-8 text-xs font-semibold px-4 cursor-pointer"
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

