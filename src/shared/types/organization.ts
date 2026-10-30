export type CustomerTierType = "regular" | "stu";

export interface IOrganization {
  id: string;
  name: string;
  code?: string | null;
  email: string | null;
  logo: string | null;
  phone: string | null;
  created_at: string;
  updated_at?: string;
  active: boolean;
  PIS: boolean;
  PAS: boolean;
  ITMS: boolean;
  v1_routes?: boolean | null;
  v2_routes?: boolean | null;
  customer_type?: CustomerTierType | null;
  deleted?: boolean;
}

export type IOrganizationCreate = Omit<Partial<IOrganization>, "id" | "created_at" | "updated_at"> & {
  name: string;
};

export type IOrganizationUpdate = Pick<IOrganization, "id"> &
  Partial<Omit<IOrganization, "id" | "created_at">>;

export type IOrganizationDelete = Pick<IOrganization, "id">;
export type IOrganizationGet = Pick<IOrganization, "id">;

export interface IOrganizationWithRegionCount extends IOrganization {
  regionsCount: number;
}

