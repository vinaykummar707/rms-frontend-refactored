import { createCrudHooks } from "@/shared/hooks/useCrud";
import type {
  IRegion,
  IRegionCreate,
  IRegionUpdate,
} from "@/shared/types/region";

export const regionCrud = createCrudHooks<
  IRegion,
  IRegionCreate,
  IRegionUpdate
>("regions");

