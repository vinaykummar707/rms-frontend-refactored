import { create } from "zustand";
import type { Screen } from "@/shared/types/routeConfigV2";

export type SimulationStore = {
  selectedSimulation: Screen | null;
  setSelectedSimulation: (value: Screen | null) => void;
  selectedSimulationIndex: number;
  setSelectedSimulationIndex: (value: number | ((prev: number) => number)) => void;
  reset: () => void;
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  selectedSimulation: null,
  setSelectedSimulation: (value) => set({ selectedSimulation: value }),
  selectedSimulationIndex: 0,
  setSelectedSimulationIndex: (value) =>
    set({
      selectedSimulationIndex:
        typeof value === "function" ? value(get().selectedSimulationIndex) : value,
    }),
  reset: () => set({ selectedSimulation: null, selectedSimulationIndex: 0 }),
}));

export default useSimulationStore;

