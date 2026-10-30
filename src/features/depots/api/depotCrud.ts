import { createCrudHooks } from "@/shared/hooks/useCrud";
import type { IDepot, IDepotCreate, IDepotUpdate } from "@/shared/types/depot";

export const depotCrud = createCrudHooks<IDepot, IDepotCreate, IDepotUpdate>("depots");

