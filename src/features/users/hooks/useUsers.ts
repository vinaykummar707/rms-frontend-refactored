import { loggedUserCrud } from "../api/userCrud";
import { roleCrud } from "../api/roleCrud";
import { useAuthStore } from "@/core/auth/authStore";
import type { ILoggedUser, IRole } from "@/shared/types/user";

export function useUsers(organizationId?: string | null) {
  const loggedInUser = useAuthStore((state) => state.user);

  const { useList: useUserList, useGet, useCreate, useUpdate, useDelete } = loggedUserCrud;
  const { data: usersData, isLoading, isError, refetch } = useUserList({
    filters: organizationId ? { organization_id: organizationId } : {},
    custom(query) {
      return query.select(`
        *,
        region:region_id (*),
        organization:organization_id (*),
        depot:depot_id (*),
        role:role_id (*)
      `);
    },
    orderBy: { column: "created_at", ascending: false },
    skip: organizationId === undefined,
  });

  const { useList: useRoleList } = roleCrud;
  const { data: rolesData, isLoading: isRolesLoading } = useRoleList();

  const users = (usersData?.data as ILoggedUser[]) || [];
  const roles = (rolesData?.data as IRole[]) || [];

  return {
    users,
    totalCount: usersData?.count ?? 0,
    roles,
    isLoading,
    isRolesLoading,
    isError,
    refetchUsers: refetch,
    loggedInUser,
    useGet,
    useCreate,
    useUpdate,
    useDelete,
  };
}

export default useUsers;
