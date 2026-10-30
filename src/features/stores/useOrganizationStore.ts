import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IOrganization } from "@/shared/types/organization";

interface OrganizationState {
  selectedOrganization: IOrganization | null;
  setSelectedOrganization: (organization: IOrganization | null) => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      selectedOrganization: null,
      setSelectedOrganization: (organization) =>
        set({ selectedOrganization: organization }),
    }),
    {
      name: "organization-storage",
      partialize: (state) => ({
        selectedOrganization: state.selectedOrganization,
      }),
    }
  )
);

export default useOrganizationStore;

