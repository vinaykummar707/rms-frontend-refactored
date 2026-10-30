import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IRegion } from "@/shared/types/region";

interface RegionStore {
  selectedRegion: IRegion | null;
  setSelectedRegion: (region: IRegion | null) => void;

  // Depots page last selected region
  depotsPageRegion: IRegion | null;
  setDepotsPageRegion: (region: IRegion | null) => void;

  // Routes page last selected region
  routesPageRegion: IRegion | null;
  setRoutesPageRegion: (region: IRegion | null) => void;
}

export const useRegionStore = create<RegionStore>()(
  persist(
    (set) => ({
      selectedRegion: null,
      setSelectedRegion: (region) => set({ selectedRegion: region }),

      depotsPageRegion: null,
      setDepotsPageRegion: (region) =>
        set({ depotsPageRegion: region, selectedRegion: region }),

      routesPageRegion: null,
      setRoutesPageRegion: (region) =>
        set({ routesPageRegion: region, selectedRegion: region }),
    }),
    {
      name: "region-storage",
      partialize: (state) => ({
        selectedRegion: state.selectedRegion,
        depotsPageRegion: state.depotsPageRegion,
        routesPageRegion: state.routesPageRegion,
      }),
    }
  )
);

export default useRegionStore;

