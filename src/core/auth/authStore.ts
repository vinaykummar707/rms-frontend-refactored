import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ILoggedUser } from "@/shared/types/user";

export interface AuthState {
  isAuthenticated: boolean;
  user: ILoggedUser | null;
  rememberMe: boolean;
  setRememberMe: (val: boolean) => void;
  login: (user: ILoggedUser) => void;
  logout: () => void;
  updateUser: (patch: Partial<ILoggedUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      rememberMe: true,
      setRememberMe: (rememberMe) => set({ rememberMe }),
      login: (user) => set({ isAuthenticated: true, user }),
      logout: () => {
        set({ isAuthenticated: false, user: null });
        try {
          sessionStorage.clear();
        } catch {
          // Ignore storage access errors
        }
      },
      updateUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : null,
        })),
    }),
    {
      name: "logged-user-store",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        rememberMe: state.rememberMe,
      }),
    }
  )
);

export default useAuthStore;

