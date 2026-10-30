import { create } from "zustand";

export const Tab = {
  FRONT: "front",
  SIDE: "side",
  REAR: "rear",
  INTERNAL: "internal",
  STOPS: "stops",
} as const;

export type TabType = (typeof Tab)[keyof typeof Tab];

export interface TabsStore {
  selectedTab: TabType;
  setSelectedTab: (value: TabType) => void;
}

export const useTabsStore = create<TabsStore>((set) => ({
  selectedTab: Tab.FRONT,
  setSelectedTab: (value) => set({ selectedTab: value }),
}));

export default useTabsStore;

