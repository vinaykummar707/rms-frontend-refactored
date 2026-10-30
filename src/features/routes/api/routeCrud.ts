import { createCrudHooks } from "@/shared/hooks/useCrud";
import type { IRoute, IRouteCreate, IRouteUpdate } from "@/shared/types/route";

export const routeCrud = createCrudHooks<IRoute, IRouteCreate, IRouteUpdate>("routes");

