import { create } from "zustand";
import type {
  IPendingSignboardZip,
  IMicrocontrollerStatus,
  ITransferFileItem,
  ITransferSummary,
  ITransferProgress,
  ITransferStatusResponse,
} from "../types/wifiTransfer";
import {
  getPendingExport,
  clearPendingExport,
  savePendingExport,
} from "../services/wifiExportStorage";
import {
  checkHardwareStatus,
  extractZipForTransfer,
  executeChunkedRouteTransfer,
} from "../services/wifiTransferService";

const STORAGE_IP_KEY = "navitronix_hardware_ip";
const DEFAULT_HARDWARE_IP = "192.168.4.1";

export interface WifiTransferState {
  // Offline package
  pendingPackage: IPendingSignboardZip | null;
  isCheckingStorage: boolean;
  isDialogOpen: boolean;

  // Hardware connection & diagnostics
  hardwareIp: string;
  hardwareStatus: IMicrocontrollerStatus | null;
  isCheckingStatus: boolean;
  statusError: string | null;

  // Extracted files & folders
  extractedFiles: ITransferFileItem[];
  extractedFolders: string[];
  isExtracting: boolean;
  extractionError: string | null;
  transferId: string;

  // Transfer state
  isUploading: boolean;
  retryingFilePath: string | null;
  uploadProgress: number; // 0-100
  uploadBytesLoaded: number;
  uploadBytesTotal: number;
  uploadSuccess: boolean;
  uploadError: string | null;
  transferProgress: ITransferProgress | null;
  transferSummary: ITransferSummary | null;
  hardwareTransferStatus: ITransferStatusResponse | null;
  abortController: AbortController | null;

  // Actions
  openDialog: () => void;
  closeDialog: () => void;
  setHardwareIp: (ip: string) => void;
  loadPendingPackage: () => Promise<void>;
  storeNewPackage: (data: Omit<IPendingSignboardZip, "id">) => Promise<void>;
  setCustomZipFile: (file: File) => Promise<void>;
  extractCurrentPackage: () => Promise<void>;
  checkStatus: () => Promise<void>;
  startUpload: () => Promise<boolean>;
  retrySingleFile: (filePath: string) => Promise<boolean>;
  retryFailedFiles: () => Promise<boolean>;
  cancelTransfer: () => void;
  discardPackage: () => Promise<void>;
  resetUploadState: () => void;
}

const getStoredHardwareIp = (): string => {
  if (typeof window !== "undefined") {
    return localStorage.getItem(STORAGE_IP_KEY) || DEFAULT_HARDWARE_IP;
  }
  return DEFAULT_HARDWARE_IP;
};

export const useWifiTransferStore = create<WifiTransferState>((set, get) => ({
  pendingPackage: null,
  isCheckingStorage: false,
  isDialogOpen: false,

  hardwareIp: getStoredHardwareIp(),
  hardwareStatus: null,
  isCheckingStatus: false,
  statusError: null,

  extractedFiles: [],
  extractedFolders: [],
  isExtracting: false,
  extractionError: null,
  transferId: "",

  isUploading: false,
  retryingFilePath: null,
  uploadProgress: 0,
  uploadBytesLoaded: 0,
  uploadBytesTotal: 0,
  uploadSuccess: false,
  uploadError: null,
  transferProgress: null,
  transferSummary: null,
  hardwareTransferStatus: null,
  abortController: null,

  openDialog: () => {
    set({ isDialogOpen: true });
    get().loadPendingPackage().then(() => {
      get().extractCurrentPackage();
    });
    get().checkStatus();
  },

  closeDialog: () => {
    const { isUploading, cancelTransfer, uploadSuccess } = get();
    if (isUploading) {
      cancelTransfer();
    }
    if (uploadSuccess) {
      set({
        pendingPackage: null,
        extractedFiles: [],
        extractedFolders: [],
        uploadSuccess: false,
        uploadProgress: 0,
        uploadBytesLoaded: 0,
        uploadBytesTotal: 0,
        transferSummary: null,
        transferProgress: null,
      });
    }
    set({ isDialogOpen: false });
  },

  setHardwareIp: (ip: string) => {
    const cleanIp = ip.trim();
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_IP_KEY, cleanIp);
    }
    set({ hardwareIp: cleanIp, hardwareStatus: null, statusError: null });
  },

  loadPendingPackage: async () => {
    set({ isCheckingStorage: true });
    try {
      const pkg = await getPendingExport();
      set({ pendingPackage: pkg, isCheckingStorage: false });
    } catch {
      set({ pendingPackage: null, isCheckingStorage: false });
    }
  },

  storeNewPackage: async (data: Omit<IPendingSignboardZip, "id">) => {
    await savePendingExport(data);
    await get().loadPendingPackage();
    await get().extractCurrentPackage();
  },

  setCustomZipFile: async (file: File) => {
    const customPkg: IPendingSignboardZip = {
      id: "current_package",
      blob: file,
      filename: file.name,
      format: "v2",
      routeCount: 1,
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
    };
    await savePendingExport(customPkg);
    set({
      pendingPackage: customPkg,
      extractedFiles: [],
      extractedFolders: [],
      transferSummary: null,
      uploadSuccess: false,
      uploadError: null,
    });
    await get().extractCurrentPackage();
  },

  extractCurrentPackage: async () => {
    const { pendingPackage } = get();
    if (!pendingPackage?.blob) {
      set({
        extractedFiles: [],
        extractedFolders: [],
        extractionError: null,
        isExtracting: false,
      });
      return;
    }

    set({ isExtracting: true, extractionError: null });
    try {
      const extracted = await extractZipForTransfer(pendingPackage.blob);
      set({
        extractedFiles: extracted.files,
        extractedFolders: extracted.folders,
        transferId: extracted.transferId,
        isExtracting: false,
        extractionError: null,
      });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Failed to parse and extract ZIP package in browser.";
      set({
        extractedFiles: [],
        extractedFolders: [],
        isExtracting: false,
        extractionError: errorMsg,
      });
    }
  },

  checkStatus: async () => {
    const { hardwareIp } = get();
    if (!hardwareIp) return;

    set({ isCheckingStatus: true, statusError: null });
    try {
      const status = await checkHardwareStatus(hardwareIp);
      set({
        hardwareStatus: status,
        isCheckingStatus: false,
        statusError: null,
      });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to connect to microcontroller.";
      set({
        hardwareStatus: null,
        isCheckingStatus: false,
        statusError: errorMsg,
      });
    }
  },

  startUpload: async (): Promise<boolean> => {
    const { pendingPackage, hardwareIp, extractedFiles, extractedFolders } = get();
    if (!pendingPackage) {
      set({ uploadError: "No pending package found to upload." });
      return false;
    }

    let filesToTransfer = extractedFiles;
    let foldersToTransfer = extractedFolders;
    let transferId = get().transferId;

    // Ensure package is extracted
    if (!filesToTransfer || filesToTransfer.length === 0) {
      set({ isExtracting: true, uploadError: null });
      try {
        const extracted = await extractZipForTransfer(pendingPackage.blob);
        filesToTransfer = extracted.files;
        foldersToTransfer = extracted.folders;
        transferId = extracted.transferId;
        set({
          extractedFiles: filesToTransfer,
          extractedFolders: foldersToTransfer,
          transferId,
          isExtracting: false,
        });
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to extract package in browser.";
        set({
          isExtracting: false,
          isUploading: false,
          uploadError: errorMsg,
        });
        return false;
      }
    }

    const abortController = new AbortController();
    const totalBytes = filesToTransfer.reduce((sum, f) => sum + f.sizeBytes, 0);

    set({
      isUploading: true,
      uploadProgress: 0,
      uploadBytesLoaded: 0,
      uploadBytesTotal: totalBytes,
      uploadSuccess: false,
      uploadError: null,
      transferSummary: null,
      abortController,
    });

    try {
      const summary = await executeChunkedRouteTransfer({
        ipOrUrl: hardwareIp,
        transferId: transferId || `route-upload-${Date.now()}`,
        files: filesToTransfer,
        totalFolders: foldersToTransfer.length,
        signal: abortController.signal,
        onProgress: (progress) => {
          set({
            transferProgress: progress,
            uploadProgress: progress.percentage,
            uploadBytesLoaded: progress.overallBytesLoaded,
            uploadBytesTotal: progress.overallBytesTotal,
          });
        },
        onFileStatusUpdate: (updatedFile) => {
          set((state) => ({
            extractedFiles: state.extractedFiles.map((f) =>
              f.path === updatedFile.path ? { ...updatedFile } : f
            ),
          }));
        },
        onTransferStatusPoll: (hwStatus) => {
          set({ hardwareTransferStatus: hwStatus });
        },
      });

      // Clear from IndexedDB on successful upload
      await clearPendingExport();

      set({
        isUploading: false,
        uploadProgress: 100,
        uploadSuccess: true,
        uploadError: null,
        transferSummary: summary,
        abortController: null,
      });

      return true;
    } catch (err: unknown) {
      const isCancelled =
        (err instanceof Error && err.message.includes("cancelled")) ||
        abortController.signal.aborted;
      const errorMsg =
        err instanceof Error ? err.message : "Failed to upload routes package.";
      set({
        isUploading: false,
        uploadSuccess: false,
        uploadError: isCancelled ? "Transfer cancelled by user." : errorMsg,
        abortController: null,
      });
      return false;
    }
  },

  retrySingleFile: async (filePath: string): Promise<boolean> => {
    const { extractedFiles, hardwareIp, isUploading, retryingFilePath } = get();
    if (isUploading || retryingFilePath) return false;

    const targetFile = extractedFiles.find((f) => f.path === filePath);
    if (!targetFile) return false;

    const abortController = new AbortController();
    set({
      retryingFilePath: filePath,
      abortController,
    });

    const fileToRetry: ITransferFileItem = {
      ...targetFile,
      status: "transferring",
      error: undefined,
      chunksSent: 0,
      bytesLoaded: 0,
    };

    // Calculate folder depth for this single file
    const pathParts = filePath.split("/");
    const foldersCount = pathParts.length > 1 ? pathParts.length - 1 : 0;
    const retryTransferId = `route-retry-${Date.now().toString(36).substring(2, 8)}`;

    try {
      const summary = await executeChunkedRouteTransfer({
        ipOrUrl: hardwareIp,
        transferId: retryTransferId,
        files: [fileToRetry],
        totalFolders: foldersCount,
        signal: abortController.signal,
        onFileStatusUpdate: (updatedFile) => {
          set((state) => ({
            extractedFiles: state.extractedFiles.map((f) =>
              f.path === updatedFile.path ? { ...updatedFile } : f
            ),
          }));
        },
      });

      const success = summary.filesSaved === 1;

      set((state) => {
        const prevSummary = state.transferSummary;
        const updatedFiles = state.extractedFiles.map((f) =>
          f.path === filePath
            ? {
                ...f,
                status: success ? ("saved" as const) : ("failed" as const),
                error: success ? undefined : f.error,
              }
            : f
        );

        const allSaved = updatedFiles.every((f) => f.status === "saved");
        const remainingFailed = updatedFiles.filter((f) => f.status === "failed");

        let newSummary = prevSummary;
        if (prevSummary && success) {
          newSummary = {
            ...prevSummary,
            filesSaved: prevSummary.filesSaved + 1,
            filesFailed: Math.max(0, prevSummary.filesFailed - 1),
            failedFiles: prevSummary.failedFiles.filter((ff) => ff.path !== filePath),
          };
        }

        return {
          retryingFilePath: null,
          abortController: null,
          extractedFiles: updatedFiles,
          transferSummary: newSummary,
          uploadSuccess: allSaved,
          uploadError:
            remainingFailed.length > 0
              ? `${remainingFailed.length} file(s) failed to transfer.`
              : null,
        };
      });

      return success;
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to retry file transfer";
      set((state) => ({
        retryingFilePath: null,
        abortController: null,
        extractedFiles: state.extractedFiles.map((f) =>
          f.path === filePath
            ? { ...f, status: "failed" as const, error: errorMsg }
            : f
        ),
      }));
      return false;
    }
  },

  retryFailedFiles: async (): Promise<boolean> => {
    const { extractedFiles, hardwareIp, isUploading, retryingFilePath } = get();
    if (isUploading || retryingFilePath) return false;

    const failedFiles = extractedFiles.filter((f) => f.status === "failed");
    if (failedFiles.length === 0) return true;

    const abortController = new AbortController();
    const totalBytes = failedFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

    set({
      isUploading: true,
      uploadProgress: 0,
      uploadBytesLoaded: 0,
      uploadBytesTotal: totalBytes,
      abortController,
      uploadError: null,
    });

    const folderSet = new Set<string>();
    for (const f of failedFiles) {
      const parts = f.path.split("/");
      if (parts.length > 1) {
        let accumulated = "";
        for (let i = 0; i < parts.length - 1; i++) {
          accumulated = accumulated ? `${accumulated}/${parts[i]}` : parts[i];
          folderSet.add(accumulated);
        }
      }
    }

    const retryTransferId = `route-retry-all-${Date.now().toString(36).substring(2, 8)}`;

    try {
      const summary = await executeChunkedRouteTransfer({
        ipOrUrl: hardwareIp,
        transferId: retryTransferId,
        files: failedFiles,
        totalFolders: folderSet.size,
        signal: abortController.signal,
        onProgress: (progress) => {
          set({
            transferProgress: progress,
            uploadProgress: progress.percentage,
            uploadBytesLoaded: progress.overallBytesLoaded,
            uploadBytesTotal: progress.overallBytesTotal,
          });
        },
        onFileStatusUpdate: (updatedFile) => {
          set((state) => ({
            extractedFiles: state.extractedFiles.map((f) =>
              f.path === updatedFile.path ? { ...updatedFile } : f
            ),
          }));
        },
      });

      set((state) => {
        const allSaved = state.extractedFiles.every((f) => f.status === "saved");
        const remainingFailed = state.extractedFiles.filter((f) => f.status === "failed");
        const prevSummary = state.transferSummary;

        let newSummary = prevSummary;
        if (prevSummary) {
          newSummary = {
            ...prevSummary,
            filesSaved: prevSummary.filesSaved + summary.filesSaved,
            filesFailed: remainingFailed.length,
            failedFiles: remainingFailed.map((f) => ({
              path: f.path,
              error: f.error || "Transfer failed",
            })),
          };
        }

        return {
          isUploading: false,
          abortController: null,
          uploadProgress: 100,
          uploadSuccess: allSaved,
          uploadError:
            remainingFailed.length > 0
              ? `${remainingFailed.length} file(s) failed to transfer.`
              : null,
          transferSummary: newSummary,
        };
      });

      return summary.filesFailed === 0;
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to retry transfer.";
      set({
        isUploading: false,
        abortController: null,
        uploadError: errorMsg,
      });
      return false;
    }
  },

  cancelTransfer: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      isUploading: false,
      uploadError: "Transfer cancelled by user.",
      abortController: null,
    });
  },

  discardPackage: async () => {
    await clearPendingExport();
    set({
      pendingPackage: null,
      extractedFiles: [],
      extractedFolders: [],
      transferSummary: null,
      transferProgress: null,
      uploadError: null,
      uploadSuccess: false,
    });
  },

  resetUploadState: () => {
    set({
      uploadProgress: 0,
      uploadBytesLoaded: 0,
      uploadBytesTotal: 0,
      uploadSuccess: false,
      uploadError: null,
      transferSummary: null,
      transferProgress: null,
    });
  },
}));
