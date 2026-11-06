"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/core/auth/authStore";
import { useSimulationStore } from "@/features/stores/useSimulationStore";
import { useTabsStore, Tab } from "@/features/stores/useTabsStore";
import { defaultDisplayConfigPostRequest } from "@/config/constants/defaultRouteValues";
import type { DisplayConfigPostRequest } from "@/shared/types/routeConfigV2";
import type { IRoute } from "@/shared/types/route";
import { RouteCreationLayout } from "./editor/RouteCreationLayout";
import { notify } from "@/core/notifications/notificationService";

interface RouteParams extends Record<string, string | undefined> {
  areaId?: string;
  depotId?: string;
  routeId?: string;
}

export const CreateRoutePage: React.FC = () => {
  const { areaId, depotId, routeId } = useParams<RouteParams>();
  const [mode, setMode] = useState<"create" | "edit">(routeId ? "edit" : "create");
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(routeId));
  const user = useAuthStore((state) => state.user);
  const setSelectedTab = useTabsStore((state) => state.setSelectedTab);

  const methods = useForm<DisplayConfigPostRequest & IRoute>({
    defaultValues: {
      ...defaultDisplayConfigPostRequest,
      organization_id: areaId || null,
      depot_id: depotId || null,
      created_by: user?.id || "",
    } as any,
  });

  // Load existing route on edit mode
  useEffect(() => {
    if (routeId) {
      const fetchRoute = async () => {
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from("routes")
            .select("*")
            .eq("id", routeId)
            .single();

          if (error) {
            console.error("Error fetching route:", error);
            notify.error("Failed to load route data: " + error.message);
            return;
          }

          if (data) {
            const parseConfig = (val: any) => {
              if (!val) return [];
              if (Array.isArray(val)) return val;
              if (typeof val === "object") return [val];
              try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : [];
              } catch (e) {
                console.warn("Could not parse route signboard config:", e);
                return [];
              }
            };

            const rawStops = parseConfig(data.stops);
            // Sanitize stops: if stops contains legacy simulation slides (format / type === "stop" without stopId), reset to []
            const cleanStops = rawStops.filter(
              (s: any) => s && (s.stopId || (s.id && !s.format && !s.texts))
            );

            methods.reset({
              ...data,
              front: parseConfig(data.front),
              rear: parseConfig(data.rear),
              side: parseConfig(data.side),
              internal: parseConfig(data.internal),
              stops: cleanStops,
            });
            setMode("edit");
          }
        } catch (err: any) {
          console.error("Unexpected error loading route:", err);
          notify.error("Unexpected error loading route data");
        } finally {
          setIsLoading(false);
        }
      };

      fetchRoute();
    }
  }, [routeId, methods]);

  // Warn user before closing/reloading tab if route form has unsaved edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (methods.formState.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [methods.formState.isDirty]);

  // Reset global simulation store and tab store state on unmount
  useEffect(() => {
    setSelectedTab(Tab.FRONT);
    return () => {
      useSimulationStore.getState().reset();
    };
  }, [setSelectedTab]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground animate-pulse font-medium">
          Loading route configuration...
        </p>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <div className="bg-background h-[100dvh] min-h-[100dvh] w-full overflow-hidden">
        <RouteCreationLayout mode={mode} />
      </div>
    </FormProvider>
  );
};

export default CreateRoutePage;

