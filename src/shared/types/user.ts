import type { IRegion } from "./region";
import type { IDepot } from "./depot";
import type { IOrganization } from "./organization";

export interface IRole {
  id: string;
  name: string;
  roleName?: string;
  active?: boolean;
  deleted?: boolean;
}

export interface Role {
  id: string;
  roleName: string;
  active: boolean;
  deleted: boolean;
}

export interface CreateRoleDto {
  roleName: string;
}

export interface UpdateRoleDto {
  roleName: string;
  active: boolean;
  deleted: boolean;
}

export interface IUser {
  id: string;
  user_id: string;
  email: string | null;
  password?: string | null;
  organization_id: string | null;
  region_id: string | null;
  depot_id: string | null;
  created_at: string;
  updated_at?: string;
  active: boolean;
  role_id: string;
  v1_routes?: boolean | null;
  v2_routes?: boolean | null;
  customer_type?: "regular" | "stu" | null;
  deleted?: boolean;
}

export interface ILoggedUser extends IUser {
  region: IRegion | null;
  organization: IOrganization | null;
  depot: IDepot | null;
  role: IRole | null;
  PIS?: boolean;
  PAS?: boolean;
  ITMS?: boolean;
}

export type IUserCreate = Omit<Partial<IUser>, "id" | "created_at" | "updated_at">;
export type ILoggedUserCreate = Omit<Partial<IUser>, "id" | "created_at" | "updated_at">;

export type IUserUpdate = Pick<IUser, "id"> &
  Partial<Omit<IUser, "id" | "created_at">>;
export type ILoggedUserUpdate = Pick<IUser, "id"> &
  Partial<Omit<IUser, "id" | "created_at">>;

export type IUserDelete = Pick<IUser, "id">;
export type IUserGet = Pick<IUser, "id">;

// Legacy DTO compatibility
export interface User {
  userId: string;
  name: string;
  userName: string;
  roleId: string;
  organizationId: string;
  areaId: string;
  depotId: string;
  active: boolean;
  deleted: boolean;
  createdAt: string;
  createdBy: string;
}

export interface CreateUserDto {
  name: string;
  userName: string;
  password: string;
  roleId: string;
  organizationId: string;
  areaId: string;
  depotId: string;
}

export interface UpdateUserDto {
  name: string;
  userName: string;
  roleId: string;
  organizationId: string;
  areaId: string;
  depotId: string;
  active: boolean;
  deleted: boolean;
}

