import { useAuthStore } from "@/core/auth/authStore";
import {
  canAccessModule,
  canAccessRole,
  canCreateUserOfRole,
  canManageResourceInTenant,
} from "./permissions";
import {
  isSuperAdmin,
  isRegularCustomer,
  isSTUCustomer,
  getCustomerTier,
  getDefaultRouteForUser,
} from "./customerTier";
import { hasUserFeature, getUserRouteAccess } from "./featureFlags";
import type { RoleType } from "@/config/constants/roles";

export function useAuthorization() {
  const user = useAuthStore((state) => state.user);

  return {
    user,
    isSuperAdmin: isSuperAdmin(user),
    isRegularCustomer: isRegularCustomer(user),
    isSTUCustomer: isSTUCustomer(user),
    customerTier: getCustomerTier(user),
    defaultRoute: getDefaultRouteForUser(user),
    routeAccess: getUserRouteAccess(user),
    canAccessModule: (mod: "PIS" | "PAS" | "ITMS") => canAccessModule(user, mod),
    canAccessRole: (roles: readonly (RoleType | string)[]) =>
      canAccessRole(user, roles),
    canCreateUserOfRole: (targetRole: string) =>
      canCreateUserOfRole(user, targetRole),
    canManageResourceInTenant: (orgId?: string | null) =>
      canManageResourceInTenant(user, orgId),
    hasFeature: (feature: string) => hasUserFeature(user, feature),
  };
}

export default useAuthorization;

