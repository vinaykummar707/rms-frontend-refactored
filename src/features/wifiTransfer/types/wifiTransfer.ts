export interface IPendingSignboardZip {
  id: "current_package";
  blob: Blob;
  filename: string;
  format: "v1" | "v2";
  routeCount: number;
  sizeBytes: number;
  createdAt: string;
  organizationId?: string;
  depotId?: string;
}

export interface IMicrocontrollerStatus {
  device_id: string;
  wifi_status: string;
  frimware: string;
  stm32_status: string;
  transfer_status: string;
  [key: string]: any;
}

export interface IHardwareUploadResponse {
  success: boolean;
  message?: string;
  routeCount?: number;
  [key: string]: any;
}

