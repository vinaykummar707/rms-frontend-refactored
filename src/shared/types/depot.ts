export interface IDepot {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
  organization_id: string;
  region_id: string;
  deleted?: boolean;
}

export type IDepotCreate = Omit<Partial<IDepot>, "id" | "created_at" | "updated_at"> & {
  name: string;
  organization_id: string;
  region_id: string;
};

export type IDepotUpdate = Pick<IDepot, "id"> &
  Partial<Omit<IDepot, "id" | "created_at">>;

export type IDepotDelete = Pick<IDepot, "id">;
export type IDepotGet = Pick<IDepot, "id">;

// Legacy DTO compatibility
export interface Depot {
  depotId: string;
  depotName: string;
  areaId: string;
  organizationId: string;
  active: boolean;
  deleted: boolean;
}

export interface CreateDepotDto {
  depotName: string;
  organizationId: string;
  areaId: string;
  active?: boolean;
  deleted?: boolean;
}

export interface UpdateDepotDto {
  depotId: string;
  depotName: string;
  organizationId: string;
  areaId: string;
  active?: boolean;
  deleted?: boolean;
}

