import { create } from "zustand";
import type {
  IPendingSignboardZip,
  IMicrocontrollerStatus,
} from "../types/wifiTransfer";
import {
  getPendingExport,
  clearPendingExport,
  savePendingExport,
} from "../services/wifiExportStorage";
import {
  checkHardwareStatus,
  uploadZipToHardware,
} from "../services/wifiTransferService";

const STORAGE_IP_KEY = "navitronix_hardware_ip";
const DEFAULT_HARDWARE_IP = "192.168.4.1";

interface WifiTransferState {
  pendingPackage: IPendingSignboardZip | null;
  isCheckingStorage: boolean;
  isDialogOpen: boolean;

  hardwareIp: string;
  hardwareStatus: IMicrocontrollerStatus | null;
  isCheckingStatus: boolean;
  statusError: string | null;

  isUploading: boolean;
  uploadProgress: number;
  uploadBytesLoaded: number;
  uploadBytesTotal: number;
  uploadSuccess: boolean;
  uploadError: string | null;

  // Actions
  openDialog: () => void;
  closeDialog: () => void;
  setHardwareIp: (ip: string) => void;
  loadPendingPackage: () => Promise<void>;
  storeNewPackage: (data: Omit<IPendingSignboardZip, "id">) => Promise<void>;
  checkStatus: () => Promise<void>;
  startUpload: () => Promise<boolean>;
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

  isUploading: false,
  uploadProgress: 0,
  uploadBytesLoaded: 0,
  uploadBytesTotal: 0,
  uploadSuccess: false,
  uploadError: null,

  openDialog: () => {
    set({ isDialogOpen: true });
    get().loadPendingPackage();
    get().checkStatus();
  },

  closeDialog: () => {
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
    } catch (err: any) {
      set({
        hardwareStatus: null,
        isCheckingStatus: false,
        statusError: err?.message || "Failed to connect to microcontroller.",
      });
    }
  },

  startUpload: async (): Promise<boolean> => {
    const { pendingPackage, hardwareIp } = get();
    if (!pendingPackage) {
      set({ uploadError: "No pending package found to upload." });
      return false;
    }

    set({
      isUploading: true,
      uploadProgress: 0,
      uploadBytesLoaded: 0,
      uploadBytesTotal: pendingPackage.sizeBytes || pendingPackage.blob.size,
      uploadSuccess: false,
      uploadError: null,
    });

    try {
      await uploadZipToHardware({
        ipOrUrl: hardwareIp,
        blob: pendingPackage.blob,
        filename: pendingPackage.filename,
        onProgress: (percent, loaded, total) => {
          set({
            uploadProgress: percent,
            uploadBytesLoaded: loaded,
            uploadBytesTotal: total,
          });
        },
      });

      // Clear from IndexedDB on successful upload
      await clearPendingExport();

      set({
        pendingPackage: null,
        isUploading: false,
        uploadProgress: 100,
        uploadSuccess: true,
        uploadError: null,
      });

      return true;
    } catch (err: any) {
      set({
        isUploading: false,
        uploadSuccess: false,
        uploadError: err?.message || "Failed to upload routes package.",
      });
      return false;
    }
  },

  discardPackage: async () => {
    await clearPendingExport();
    set({ pendingPackage: null });
  },

  resetUploadState: () => {
    set({
      uploadProgress: 0,
      uploadBytesLoaded: 0,
      uploadBytesTotal: 0,
      uploadSuccess: false,
      uploadError: null,
    });
  },
}));

