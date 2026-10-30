import { create } from "zustand";
import type { Area } from "@/shared/types/region";

interface AreaStore {
  selectedArea: Area | null;
  setSelectedArea: (area: Area | null) => void;
}

export const useAreaStore = create<AreaStore>((set) => ({
  selectedArea: null,
  setSelectedArea: (area) => set({ selectedArea: area }),
}));

export default useAreaStore;

