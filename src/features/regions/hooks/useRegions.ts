import { useEffect } from "react";
import { regionCrud } from "../api/regionCrud";
import { useRegionStore } from "@/features/stores/useRegionStore";
import { useOrganizationStore } from "@/features/stores/useOrganizationStore";
import type { IRegion } from "@/shared/types/region";

export function useRegions() {
  const { selectedOrganization } = useOrganizationStore();
  const selectedRegion = useRegionStore((state) => state.selectedRegion);
  const setSelectedRegion = useRegionStore((state) => state.setSelectedRegion);

  const { useList, useGet, useCreate, useUpdate, useDelete } = regionCrud;
  const { data, isLoading, isError, refetch } = useList({
    filters: {
      organization_id: selectedOrganization?.id || "",
    },
    orderBy: { column: "created_at", ascending: true },
    skip: !selectedOrganization?.id,
  });

  const regions = (data?.data as IRegion[]) || [];

  useEffect(() => {
    if (regions.length > 0 && !selectedRegion) {
      setSelectedRegion(regions[0]);
    }
  }, [regions, selectedRegion, setSelectedRegion]);

  useEffect(() => {
    if (selectedOrganization?.id) {
      refetch();
    }
  }, [selectedOrganization?.id, refetch]);

  return {
    regions,
    totalCount: data?.count ?? 0,
    isLoading,
    isError,
    refetchRegions: refetch,
    selectedRegion,
    setSelectedRegion,
    useGet,
    useCreate,
    useUpdate,
    useDelete,
  };
}

export default useRegions;

