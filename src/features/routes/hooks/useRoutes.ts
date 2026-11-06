import { useMemo } from "react";
import { routeCrud } from "../api/routeCrud";
import {
  createReturnRoute,
  duplicateRoute,
  exportRoutes,
} from "../services/routeService";
import { useWifiTransferStore } from "@/features/wifiTransfer/stores/useWifiTransferStore";
import { sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import type { IRoute } from "@/shared/types/route";

export function useRoutes(depotId?: string, organizationId?: string) {
  const { useList, useGet, useCreate, useUpdate, useDelete, useDeleteAll } = routeCrud;

  const { data: routesData, isLoading, isError, refetch } = useList({
    filters: {
      depot_id: depotId || "",
      ...(organizationId ? { organization_id: organizationId } : {}),
    },
    orderBy: { column: "created_at", ascending: false },
    custom(query) {
      return query.select(`*, created_by_user:created_by (email)`);
    },
    skip: !depotId,
  });

  const routes = useMemo(() => {
    const list = (routesData?.data as IRoute[]) || [];
    return sortByLatestCreated(list);
  }, [routesData]);

  const handleReturn = async (routeId: string, suffix: string = "R", userId?: string) => {
    try {
      const created = await createReturnRoute(routeId, suffix, userId);
      notify.success("Return route created successfully");
      refetch();
      return created;
    } catch (err: any) {
      notify.error(err.message || "Failed to create return route");
      throw err;
    }
  };

  const handleDuplicate = async (routeId: string, suffix: string = "D", userId?: string) => {
    try {
      const duplicated = await duplicateRoute(routeId, suffix, userId);
      notify.success(`Route duplicated as "${duplicated.route_number}"`);
      refetch();
      return duplicated;
    } catch (err: any) {
      notify.error(err.message || "Failed to duplicate route");
      throw err;
    }
  };

  const handleExport = async (routesToExport: IRoute[], format: "v1" | "v2") => {
    try {
      notify.info(`Requesting ${format.toUpperCase()} export package...`);
      await exportRoutes(routesToExport, format, { organizationId, depotId });
      await useWifiTransferStore.getState().loadPendingPackage();
      useWifiTransferStore.getState().openDialog();
      notify.success(
        `Package prepared for Signboard Wi-Fi Transfer (${routesToExport.length} route(s))`
      );
    } catch (err: any) {
      notify.error(err.message || "Export failed");
      throw err;
    }
  };

  return {
    routes,
    totalCount: routesData?.count ?? 0,
    isLoading,
    isError,
    refetchRoutes: refetch,
    handleReturn,
    handleDuplicate,
    handleExport,
    useGet,
    useCreate,
    useUpdate,
    useDelete,
    useDeleteAll,
  };
}

export default useRoutes;

