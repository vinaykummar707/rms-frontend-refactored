import { createCrudHooks } from "@/shared/hooks/useCrud";
import type { IRole } from "@/shared/types/user";

export const roleCrud = createCrudHooks<IRole, Omit<IRole, "id">, Omit<IRole, "id">>(
  "roles"
);

