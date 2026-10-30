export interface IRegion {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
  organization_id: string;
  deleted?: boolean;
}

export type IRegionCreate = Omit<Partial<IRegion>, "id" | "created_at" | "updated_at"> & {
  name: string;
  organization_id: string;
};

export type IRegionUpdate = Pick<IRegion, "id"> &
  Partial<Omit<IRegion, "id" | "created_at">>;

export type IRegionDelete = Pick<IRegion, "id">;
export type IRegionGet = Pick<IRegion, "id">;

// Legacy DTO compatibility
export interface Area {
  areaId?: string;
  areaName: string;
  organizationId: string;
  active?: boolean;
  deleted?: boolean;
  createdAt?: string;
  createdBy?: string;
}

export interface CreateAreaDto {
  areaName: string;
  organizationId: string;
}

export interface UpdateAreaDto {
  areaName: string;
  organizationId: string;
  active?: boolean;
  deleted?: boolean;
}

