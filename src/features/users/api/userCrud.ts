import { createCrudHooks } from "@/shared/hooks/useCrud";
import type {
  IUser,
  IUserCreate,
  IUserUpdate,
  ILoggedUser,
  ILoggedUserCreate,
  ILoggedUserUpdate,
} from "@/shared/types/user";

export const userCrud = createCrudHooks<IUser, IUserCreate, IUserUpdate>("users");

export const loggedUserCrud = createCrudHooks<
  ILoggedUser,
  ILoggedUserCreate,
  ILoggedUserUpdate
>("users");

