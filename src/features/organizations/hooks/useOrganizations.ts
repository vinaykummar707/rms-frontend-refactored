import { organizationCrud } from "../api/organizationCrud";
import { useOrganizationStore } from "@/features/stores/useOrganizationStore";

export function useOrganizations() {
  const { selectedOrganization, setSelectedOrganization } = useOrganizationStore();
  const { useList, useGet, useCreate, useUpdate, useDelete } = organizationCrud;

  const { data, isLoading, isError, refetch } = useList({
    orderBy: { column: "created_at", ascending: false },
  });

  return {
    organizations: data?.data ?? [],
    totalCount: data?.count ?? 0,
    isLoading,
    isError,
    refetch,
    selectedOrganization,
    setSelectedOrganization,
    useGet,
    useCreate,
    useUpdate,
    useDelete,
  };
}

export default useOrganizations;

