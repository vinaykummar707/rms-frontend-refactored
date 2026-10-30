import { create } from "zustand";

export interface ToggleState {
  isRoutePanelOpen: boolean;
  toggleRoutePanel: () => void;
  setRoutePanelOpen: (open: boolean) => void;
  isInspectorOpen: boolean;
  toggleInspector: () => void;
  setInspectorOpen: (open: boolean) => void;
  isSimulationSettingsPanelOpen: boolean;
  isTextSettingsPanelOpen: boolean;
  isRouteSettingsPanelOpen: boolean;
  toggleSimulationSettingsPanel: () => void;
  toggleTextSettingsPanel: () => void;
  toggleRouteSettingsPanel: () => void;
  showSidebar: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useToggleStore = create<ToggleState>((set) => ({
  isRoutePanelOpen: true,
  toggleRoutePanel: () =>
    set((state) => ({ isRoutePanelOpen: !state.isRoutePanelOpen })),
  setRoutePanelOpen: (open: boolean) => set({ isRoutePanelOpen: open }),
  isInspectorOpen: true,
  toggleInspector: () =>
    set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
  setInspectorOpen: (open: boolean) => set({ isInspectorOpen: open }),
  isSimulationSettingsPanelOpen: true,
  isTextSettingsPanelOpen: true,
  isRouteSettingsPanelOpen: true,
  toggleSimulationSettingsPanel: () =>
    set((state) => ({
      isSimulationSettingsPanelOpen: !state.isSimulationSettingsPanelOpen,
    })),
  toggleTextSettingsPanel: () =>
    set((state) => ({
      isTextSettingsPanelOpen: !state.isTextSettingsPanelOpen,
    })),
  toggleRouteSettingsPanel: () =>
    set((state) => ({
      isRouteSettingsPanelOpen: !state.isRouteSettingsPanelOpen,
    })),
  showSidebar: true,
  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
  setSidebarOpen: (open: boolean) => set({ showSidebar: open }),
  isMobileMenuOpen: false,
  toggleMobileMenu: () =>
    set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  setMobileMenuOpen: (open: boolean) => set({ isMobileMenuOpen: open }),
}));

export default useToggleStore;

