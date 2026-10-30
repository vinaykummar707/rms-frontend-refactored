import type { ILoggedUser, IUser } from "@/shared/types/user";
import { ROLES } from "@/config/constants/roles";

export type CustomerTier = "super_admin" | "regular" | "stu";

/**
 * Checks if the logged in user is Navitronix Super Admin ('master' or 'super_admin').
 */
export function isSuperAdmin(
  user: ILoggedUser | IUser | null | undefined
): boolean {
  if (!user) return false;
  const roleName = (user as any).role?.name?.toLowerCase() || "";
  return roleName === "master" || roleName === "super_admin";
}

/**
 * Checks if the user is a Regular Customer (independent body builder, freelancer).
 * A regular customer does not belong to an STU organization, has no regions, and has no depots.
 */
export function isRegularCustomer(
  user: ILoggedUser | IUser | null | undefined
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return false;

  if ((user as any).customer_type === "regular") return true;
  if ((user as any).organization?.customer_type === "regular") return true;

  const roleName = (user as any).role?.name?.toLowerCase() || "";
  if (roleName === "guest") return false;
  if (roleName === "user") return true;

  if (!user.organization_id) return true;

  return false;
}

/**
 * Checks if the user is an STU Customer (organized State Transport Undertaking).
 * STU customers have a mandatory organization, and manage a hierarchy of regions, depots, and staff users.
 */
export function isSTUCustomer(
  user: ILoggedUser | IUser | null | undefined
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return false;
  if (isRegularCustomer(user)) return false;

  const roleName = (user as any).role?.name?.toLowerCase() || "";
  if (["organization_admin", "depot_admin", "region_admin", "area_admin"].includes(roleName)) {
    return true;
  }

  return Boolean(user.organization_id);
}

/**
 * Resolves the primary customer tier of the user.
 */
export function getCustomerTier(
  user: ILoggedUser | IUser | null | undefined
): CustomerTier {
  if (isSuperAdmin(user)) return "super_admin";
  if (isRegularCustomer(user)) return "regular";
  return "stu";
}

/**
 * Resolves the default landing route for a logged-in user.
 */
export function getDefaultRouteForUser(
  currentUser: ILoggedUser | IUser | null | undefined
): string {
  if (!currentUser) return "/login";
  if (isRegularCustomer(currentUser)) return "/home/regular-routes";
  const role = (currentUser as any).role?.name?.toLowerCase();
  switch (role) {
    case "master":
    case "super_admin":
    case ROLES.SUPER_ADMIN:
    case ROLES.ORGANIZATION_ADMIN:
    case ROLES.REGION_ADMIN:
    case ROLES.AREA_ADMIN:
      return "/home/dashboard";
    case ROLES.GUEST:
      return "/home/organizations";
    case ROLES.DEPOT_ADMIN:
      return "/home/routes";
    default:
      return "/home/routes";
  }
}
