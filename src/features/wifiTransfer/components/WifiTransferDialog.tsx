import React, { useState, useRef, useMemo } from "react";
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
  Cpu,
  FolderTree,
  FileCode,
  FileText,
  FileArchive,
  Clock,
  FileUp,
  X,
  Check,
  Search,
} from "lucide-react";
import { saveAs } from "file-saver";
import { cn } from "cn";
import { useWifiTransferStore } from "../stores/useWifiTransferStore";
import type { ITransferFileItem } from "../types/wifiTransfer";

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

type FileFilterTab = "all" | "pending" | "transferring" | "saved" | "failed";

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
    extractedFiles,
    extractedFolders,
    isExtracting,
    extractionError,
    setCustomZipFile,
    isUploading,
    retryingFilePath,
    uploadProgress,
    uploadBytesLoaded,
    uploadBytesTotal,
    uploadSuccess,
    uploadError,
    transferProgress,
    transferSummary,
    startUpload,
    retrySingleFile,
    retryFailedFiles,
    cancelTransfer,
    discardPackage,
    resetUploadState,
  } = useWifiTransferStore();

  const [inputIp, setInputIp] = useState<string>(hardwareIp);
  const [prevHardwareIp, setPrevHardwareIp] = useState<string>(hardwareIp);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterTab, setFilterTab] = useState<FileFilterTab>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync inputIp when hardwareIp changes from store
  if (hardwareIp !== prevHardwareIp) {
    setPrevHardwareIp(hardwareIp);
    setInputIp(hardwareIp);
  }

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await setCustomZipFile(file);
      e.target.value = "";
    }
  };

  const handleStartUpload = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    await startUpload();
  };

  const handleClose = () => {
    if (isUploading) {
      cancelTransfer();
    }
    resetUploadState();
    closeDialog();
  };

  // Status counts for filter chips
  const counts = useMemo(() => {
    return {
      all: extractedFiles.length,
      pending: extractedFiles.filter((f) => f.status === "pending").length,
      transferring: extractedFiles.filter((f) => f.status === "transferring").length,
      saved: extractedFiles.filter((f) => f.status === "saved").length,
      failed: extractedFiles.filter((f) => f.status === "failed").length,
    };
  }, [extractedFiles]);

  // Filtered files list
  const filteredFiles = useMemo(() => {
    let list = extractedFiles;
    if (filterTab !== "all") {
      list = list.filter((f) => f.status === filterTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((f) => f.path.toLowerCase().includes(q));
    }
    return list;
  }, [extractedFiles, filterTab, searchQuery]);

  const totalExtractedBytes = useMemo(() => {
    return extractedFiles.reduce((sum, f) => sum + f.sizeBytes, 0);
  }, [extractedFiles]);

  const hasFilesOrPackage = Boolean(pendingPackage || extractedFiles.length > 0);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (!open && isUploading) return;
        if (!open) handleClose();
      }}
      disablePointerDismissal={true}
    >
      <DialogContent
        className="sm:max-w-3xl p-6 max-h-[92vh] overflow-y-auto"
        showCloseButton={!isUploading}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".zip,application/zip"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Dialog Header */}
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold">
                    Signboard Wi-Fi Transfer
                  </DialogTitle>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                    USART3 FatFs v1.0
                  </span>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Stream extracted route files sequentially to STM32 SD card with per-file progress & backpressure.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Section 1: Microcontroller Hardware Connection */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Signboard Hardware Connection
                </span>
              </div>
              {hardwareStatus ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Signboard Connected ({hardwareStatus.device_id})
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Not Connected
                </span>
              )}
            </div>

            {/* IP Input & Ping */}
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
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePing}
                disabled={isCheckingStatus || isUploading}
                className="h-8 text-xs font-medium px-3 shrink-0 cursor-pointer"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5 mr-1.5", isCheckingStatus && "animate-spin")}
                />
                Test Connection
              </Button>
            </div>

            {/* Hardware Status Details Grid */}
            {hardwareStatus && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-0.5">
                <div className="p-1.5 rounded-md bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground block font-medium">Device ID</span>
                  <span className="font-semibold truncate block">{hardwareStatus.device_id}</span>
                </div>
                <div className="p-1.5 rounded-md bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground block font-medium">ESP Firmware</span>
                  <span className="font-semibold block font-mono">v{hardwareStatus.esp_firmware}</span>
                </div>
                <div className="p-1.5 rounded-md bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground block font-medium">STM32 Driver</span>
                  <span
                    className={cn(
                      "font-semibold block capitalize",
                      hardwareStatus.stm32_status === "ready" || hardwareStatus.stm32_status === "connected"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {hardwareStatus.stm32_status}
                  </span>
                </div>
                <div className="p-1.5 rounded-md bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground block font-medium">Storage Free</span>
                  <span className="font-semibold block truncate">
                    {hardwareStatus.free_bytes !== undefined ? formatBytes(hardwareStatus.free_bytes) : "Ready"}
                  </span>
                </div>
              </div>
            )}

            {/* Status Error Notice */}
            {statusError && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Hardware unreachable ({statusError})</span>
                  <p className="text-[11px] text-muted-foreground">
                    Connect your PC/device to the Signboard's Wi-Fi hotspot in network settings, then test connection.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: OVERALL TRANSFER PROGRESS (Always visible above file list when active / finished / ready) */}
          {(isUploading || uploadSuccess || uploadError || extractedFiles.length > 0) && (
            <div
              className={cn(
                "rounded-xl border p-4 space-y-3 transition-colors",
                uploadSuccess
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : isUploading
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : uploadError && counts.failed > 0
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UploadCloud
                    className={cn(
                      "h-4 w-4",
                      isUploading ? "animate-bounce text-primary" : uploadSuccess ? "text-emerald-600" : "text-muted-foreground"
                    )}
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Overall Transfer Progress
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isUploading && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={cancelTransfer}
                      className="h-6 text-[11px] px-2 text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer"
                    >
                      <X className="h-3 w-3 mr-1" /> Cancel Transfer
                    </Button>
                  )}
                  <span className="font-mono font-bold text-sm text-foreground">
                    {uploadProgress}%
                  </span>
                </div>
              </div>

              {/* Overall Progress Track */}
              <Progress value={uploadProgress} className="h-2.5" />

              {/* Progress Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-0.5">
                <div className="p-2 rounded-lg bg-card/70 border border-border/50">
                  <span className="text-[10px] text-muted-foreground block font-medium">Files Saved</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {counts.saved} of {counts.all}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-card/70 border border-border/50">
                  <span className="text-[10px] text-muted-foreground block font-medium">Failed Files</span>
                  <span
                    className={cn(
                      "font-bold",
                      counts.failed > 0 ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {counts.failed} file(s)
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-card/70 border border-border/50">
                  <span className="text-[10px] text-muted-foreground block font-medium">Bytes Streamed</span>
                  <span className="font-semibold font-mono">
                    {formatBytes(uploadBytesLoaded)} / {formatBytes(uploadBytesTotal || totalExtractedBytes)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-card/70 border border-border/50">
                  <span className="text-[10px] text-muted-foreground block font-medium">SD Target Folders</span>
                  <span className="font-semibold">
                    {extractedFolders.length} directory/ies
                  </span>
                </div>
              </div>

              {/* Active Status Banner */}
              {isUploading && transferProgress && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-primary/10">
                  <span className="truncate pr-2">
                    <span className="font-medium text-foreground">Active:</span> {transferProgress.statusMessage}
                  </span>
                  <span className="font-mono shrink-0">
                    Chunk {transferProgress.currentChunkIndex}/{transferProgress.currentTotalChunks}
                  </span>
                </div>
              )}

              {uploadSuccess && transferSummary && (
                <div className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-200 pt-1 border-t border-emerald-500/20">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    All route files verified and saved to STM32 SD card in {(transferSummary.durationMs / 1000).toFixed(1)}s
                  </span>
                  <span className="font-mono text-[10px]">ID: {transferSummary.transferId}</span>
                </div>
              )}

              {uploadError && !isUploading && counts.failed === 0 && (
                <div className="text-[11px] text-destructive pt-1 border-t border-destructive/20 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Controls Section (Positioned below Overall Progress) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-8 text-xs px-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Select a different export ZIP archive"
              >
                <FileUp className="h-3.5 w-3.5 mr-1.5" /> Choose ZIP
              </Button>

              {hasFilesOrPackage && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadBackup}
                    disabled={isUploading}
                    className="h-8 text-xs px-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Save a backup copy to your computer"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Backup PC
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={discardPackage}
                    disabled={isUploading}
                    className="h-8 text-xs px-2.5 text-destructive hover:text-destructive cursor-pointer"
                    title="Clear this package from offline storage"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Discard
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {counts.failed > 0 && !isUploading && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => retryFailedFiles()}
                  disabled={Boolean(retryingFilePath)}
                  className="h-8 text-xs font-semibold px-3 text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Failed ({counts.failed})
                </Button>
              )}

              {!uploadSuccess ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleStartUpload}
                  disabled={!hasFilesOrPackage || isUploading || isExtracting}
                  className="h-8 text-xs font-semibold px-4 cursor-pointer gap-1.5"
                >
                  <UploadCloud className="h-4 w-4" />
                  {isUploading
                    ? `Streaming (${uploadProgress}%)`
                    : counts.failed > 0
                    ? "Restart Transfer"
                    : "Upload to Signboard"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleClose}
                  className="h-8 text-xs font-semibold px-5 cursor-pointer"
                >
                  Done
                </Button>
              )}
            </div>
          </div>

          {/* Section 3: SCROLLABLE LIST OF ALL FILES AS INDIVIDUAL CARDS */}
          {hasFilesOrPackage ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {/* Header with Title and Search/Filters */}
              <div className="flex  flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Extracted Files ({extractedFiles.length})
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    • {formatBytes(totalExtractedBytes)}
                  </span>
                </div>

                {/* Filter Tabs & Search Bar */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="relative flex-1 sm:w-44">
                    <Search className="h-3 w-3 absolute left-2 top-2.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search paths..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-7 text-xs pl-7 pr-2"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg text-[10px] font-medium shrink-0">
                    <button
                      type="button"
                      onClick={() => setFilterTab("all")}
                      className={cn(
                        "px-2 py-1 rounded transition-colors cursor-pointer",
                        filterTab === "all" ? "bg-background text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      All ({counts.all})
                    </button>
                    {counts.transferring > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterTab("transferring")}
                        className={cn(
                          "px-2 py-1 rounded transition-colors cursor-pointer text-primary",
                          filterTab === "transferring" ? "bg-background shadow-2xs font-semibold" : "hover:text-primary"
                        )}
                      >
                        Active ({counts.transferring})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFilterTab("saved")}
                      className={cn(
                        "px-2 py-1 rounded transition-colors cursor-pointer",
                        filterTab === "saved" ? "bg-background text-emerald-600 shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Saved ({counts.saved})
                    </button>
                    {counts.failed > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterTab("failed")}
                        className={cn(
                          "px-2 py-1 rounded transition-colors cursor-pointer text-destructive",
                          filterTab === "failed" ? "bg-background shadow-2xs font-semibold" : "hover:text-destructive"
                        )}
                      >
                        Failed ({counts.failed})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Extraction State */}
              {isExtracting ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <span>Extracting ZIP archive in browser and preparing chunk streams...</span>
                </div>
              ) : extractionError ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Extraction Failed</span>
                    <span>{extractionError}</span>
                  </div>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No files match the current filter or search query.
                </div>
              ) : (
                /* Scrollable List of Individual File Cards */
                <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1.5">
                  {filteredFiles.map((file) => (
                    <FileCard
                      key={file.path}
                      file={file}
                      isUploading={isUploading}
                      isRetrying={retryingFilePath === file.path}
                      onRetry={() => retrySingleFile(file.path)}
                      onCancel={() => cancelTransfer()}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Empty State when no package is loaded */
            <div className="py-8 text-center space-y-3 border border-dashed border-border rounded-xl bg-muted/20 p-6">
              <FileArchive className="h-9 w-9 text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <span className="font-semibold text-sm text-foreground block">
                  No Route Package Queued
                </span>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Export routes from the Routes page or choose an exported ZIP archive from your computer to stream to the Signboard.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs font-semibold px-4 cursor-pointer gap-1.5"
              >
                <FileUp className="h-3.5 w-3.5" /> Select Route ZIP Archive
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Individual File Card Component
// ============================================================================

interface FileCardProps {
  file: ITransferFileItem;
  isUploading: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  onCancel: () => void;
}

const FileCard: React.FC<FileCardProps> = ({
  file,
  isUploading,
  isRetrying,
  onRetry,
  onCancel,
}) => {
  // Calculate percentage loaded for this individual file
  const filePercent = useMemo(() => {
    if (file.status === "saved") return 100;
    if (file.status === "pending") return 0;
    if (file.sizeBytes <= 0) return 0;
    const loaded = file.bytesLoaded ?? file.chunksSent * 512;
    return Math.min(100, Math.round((loaded * 100) / file.sizeBytes));
  }, [file]);

  const isBinary = file.path.endsWith(".bin") || file.path.endsWith(".mbin");

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition-all text-xs space-y-2 shadow-2xs",
        file.status === "transferring"
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
          : file.status === "saved"
          ? "border-emerald-500/20 bg-card hover:border-emerald-500/40"
          : file.status === "failed"
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card hover:border-border/80"
      )}
    >
      {/* Top Row: Path, Size, Status Badge & Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate min-w-0">
          <div
            className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
              file.status === "saved"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : file.status === "failed"
                ? "bg-destructive/10 text-destructive"
                : file.status === "transferring"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isBinary ? <FileCode className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          </div>

          <div className="truncate min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-mono font-semibold text-foreground truncate block" title={`/${file.path}`}>
                /{file.path}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0 font-sans">
                ({formatBytes(file.sizeBytes)})
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge & Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {file.status === "saved" && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-600" /> Saved
            </span>
          )}

          {file.status === "transferring" && (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                {filePercent}%
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="h-6 text-[10px] px-2 text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer"
                title="Cancel ongoing transfer"
              >
                <X className="h-3 w-3 mr-0.5" /> Cancel
              </Button>
            </div>
          )}

          {file.status === "failed" && (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Failed
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isUploading || isRetrying}
                className="h-6 text-[10px] font-semibold px-2 text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer"
                title={`Retry transferring /${file.path}`}
              >
                <RefreshCw
                  className={cn("h-2.5 w-2.5 mr-1", isRetrying && "animate-spin")}
                />
                {isRetrying ? "Retrying..." : "Retry"}
              </Button>
            </div>
          )}

          {file.status === "pending" && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/40 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Queued
            </span>
          )}
        </div>
      </div>

      {/* Middle: Progress Bar for this Individual File */}
      <div className="space-y-1">
        <Progress
          value={filePercent}
          className={cn(
            "h-1.5",
            file.status === "saved" && "[&_[data-slot=progress-indicator]]:bg-emerald-500",
            file.status === "failed" && "[&_[data-slot=progress-indicator]]:bg-destructive"
          )}
        />
      </div>

      {/* Bottom Sub-row: Chunks, Bytes, and Status Message */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-mono text-[10px]">
          {file.status === "saved" ? (
            <span>All {file.chunksTotal} chunk(s) confirmed written</span>
          ) : file.status === "transferring" ? (
            <span>
              Chunk {file.chunksSent} of {file.chunksTotal} ({formatBytes(file.bytesLoaded || 0)} / {formatBytes(file.sizeBytes)})
            </span>
          ) : (
            <span>Expected chunks: {file.chunksTotal} (512 B)</span>
          )}
        </span>

        {file.status === "failed" ? (
          <span className="text-destructive font-sans truncate pl-2 font-medium" title={file.error}>
            {file.error || "STM32 FatFs write failure"}
          </span>
        ) : file.status === "saved" ? (
          <span className="text-emerald-700 dark:text-emerald-400 font-sans font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Confirmed on STM32 FatFs SD card
          </span>
        ) : file.status === "transferring" ? (
          <span className="text-primary italic">Streaming chunk to STM32 UART...</span>
        ) : (
          <span>Waiting in queue...</span>
        )}
      </div>
    </div>
  );
};
