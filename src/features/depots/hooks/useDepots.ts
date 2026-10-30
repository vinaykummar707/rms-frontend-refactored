import { useEffect } from "react";
import { depotCrud } from "../api/depotCrud";
import { useDepotStore } from "@/features/stores/useDepotStore";
import type { IDepot } from "@/shared/types/depot";

export function useDepots(regionId?: string) {
  const selectedDepot = useDepotStore((state) => state.selectedDepot);
  const setSelectedDepot = useDepotStore((state) => state.setSelectedDepot);

  const { useList, useGet, useCreate, useUpdate, useDelete } = depotCrud;
  const { data, isLoading, isError, refetch } = useList({
    filters: { region_id: regionId || "" },
    orderBy: { column: "created_at", ascending: true },
    skip: !regionId,
  });

  const depots = (data?.data as IDepot[]) || [];

  useEffect(() => {
    if (depots.length > 0 && !selectedDepot) {
      setSelectedDepot(depots[0]);
    }
    if (depots && depots.length === 0) {
      setSelectedDepot(null);
    }
  }, [depots, selectedDepot, setSelectedDepot]);

  return {
    depots,
    totalCount: data?.count ?? 0,
    isLoading,
    isError,
    refetchDepots: refetch,
    selectedDepot,
    setSelectedDepot,
    useGet,
    useCreate,
    useUpdate,
    useDelete,
  };
}

export default useDepots;

