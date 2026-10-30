import { createCrudHooks } from "@/shared/hooks/useCrud";
import type {
  IOrganization,
  IOrganizationCreate,
  IOrganizationUpdate,
} from "@/shared/types/organization";

export const organizationCrud = createCrudHooks<
  IOrganization,
  IOrganizationCreate,
  IOrganizationUpdate
>("organizations");

