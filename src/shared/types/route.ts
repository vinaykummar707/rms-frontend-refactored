export interface IRoute {
  id: string;
  route_number: string;
  source: string;
  destination: string;
  separation: string;
  via: string;
  route_number_1: string;
  route_number_2: string;
  is_split_route: boolean;
  front: string;
  side: string;
  rear: string;
  internal: string;
  stops: string;
  created_at: string;
  updated_at?: string;
  organization_id?: string | null;
  depot_id?: string | null;
  version: string;
  return: boolean;
  created_by: string;
  created_by_user?: {
    email: string;
  };
  config?: string;
  deleted?: boolean;
}

export type IRouteCreate = Omit<Partial<IRoute>, "id" | "created_at" | "updated_at">;

export type IRouteUpdate = Pick<IRoute, "id"> &
  Partial<Omit<IRoute, "id" | "created_at">>;

export type IRouteDelete = Pick<IRoute, "id">;
export type IRouteGet = Pick<IRoute, "id">;

