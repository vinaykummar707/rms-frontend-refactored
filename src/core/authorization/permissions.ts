import type { ILoggedUser } from "@/shared/types/user";
import { ROLES, type RoleType } from "@/config/constants/roles";
import { isSuperAdmin, isRegularCustomer } from "./customerTier";
import { hasUserFeature } from "./featureFlags";

export function canAccessModule(
  user: ILoggedUser | null | undefined,
  moduleName: "PIS" | "PAS" | "ITMS"
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return hasUserFeature(user, moduleName);
}

export function canAccessRole(
  user: ILoggedUser | null | undefined,
  allowedRoles: readonly (RoleType | string)[]
): boolean {
  if (!user) return false;
  if (allowedRoles.length === 0) return true;

  const isSuper = isSuperAdmin(user);
  const isRegular = isRegularCustomer(user);
  const userRole = user.role?.name?.toLowerCase();
  const lowerRoles = allowedRoles.map((r) => r.toLowerCase());

  if (isSuper && lowerRoles.includes(ROLES.MASTER)) return true;
  if (isRegular && (lowerRoles.includes(ROLES.USER) || lowerRoles.includes("regular"))) return true;
  if (userRole && lowerRoles.includes(userRole)) return true;

  return false;
}

export function canCreateUserOfRole(
  loggedInUser: ILoggedUser | null | undefined,
  targetRoleName: string
): boolean {
  if (!loggedInUser) return false;
  const isSuper = isSuperAdmin(loggedInUser);
  const loggedInRole = loggedInUser.role?.name?.toLowerCase();
  const targetLower = targetRoleName.toLowerCase();

  // No role can create an account of their own role
  if (loggedInRole === targetLower) return false;

  // Organization admin can ONLY be created by master (super admin)
  if (targetLower === "organization_admin" && !isSuper) return false;

  if (isSuper) {
    return [
      "organization_admin",
      "region_admin",
      "depot_admin",
      "user",
      "guest",
    ].includes(targetLower);
  }

  if (loggedInRole === "organization_admin") {
    return targetLower === "region_admin" || targetLower === "depot_admin";
  }

  if (loggedInRole === "region_admin") {
    return targetLower === "depot_admin";
  }

  return false;
}

export function canManageResourceInTenant(
  user: ILoggedUser | null | undefined,
  resourceOrganizationId?: string | null
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isRegularCustomer(user)) return false;

  const userOrgId = user.organization_id || user.organization?.id;
  return Boolean(userOrgId && userOrgId === resourceOrganizationId);
}

