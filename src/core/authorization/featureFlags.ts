import type { ILoggedUser } from "@/shared/types/user";

/**
 * Checks if a user has access to a specific feature flag.
 * Evaluates in order:
 * 1. Super Admin ('master' or 'super_admin') -> always has access
 * 2. User-level flag (if explicitly set)
 * 3. Organization-level flag (if explicitly set)
 * 4. Feature-specific default fallback:
 *    - 'v2_routes' defaults to true
 *    - 'v1_routes' defaults to false
 *    - other features default to false
 */
export function hasUserFeature(
  user: ILoggedUser | null | undefined,
  feature: string
): boolean {
  if (!user) return false;
  const roleName = user.role?.name?.toLowerCase();
  if (
    roleName === "master" ||
    roleName === "super_admin" ||
    roleName === "super admin"
  ) {
    return true;
  }

  const userObj = user as any;
  const userOrg = user.organization as any;

  const getFeatureValue = (target: any, feat: string) => {
    if (!target) return undefined;
    const lower = feat.toLowerCase();
    const upper = feat.toUpperCase();
    if (Array.isArray(target.features)) {
      if (
        target.features.includes(feat) ||
        target.features.includes(lower) ||
        target.features.includes(upper)
      ) {
        return true;
      }
    }
    if (target[feat] !== undefined && target[feat] !== null) {
      return Boolean(target[feat]);
    }
    if (target[lower] !== undefined && target[lower] !== null) {
      return Boolean(target[lower]);
    }
    if (target[upper] !== undefined && target[upper] !== null) {
      return Boolean(target[upper]);
    }
    return undefined;
  };

  // 1. Explicit user-level flag
  const userVal = getFeatureValue(userObj, feature);
  if (userVal !== undefined) return userVal;

  // 2. Explicit organization-level flag
  const orgVal = getFeatureValue(userOrg, feature);
  if (orgVal !== undefined) return orgVal;

  // 3. Sensible defaults
  if (feature.toLowerCase() === "v2_routes") {
    return true;
  }
  if (feature.toLowerCase() === "v1_routes") {
    return false;
  }

  return false;
}

/**
 * Returns an object containing the user's route capabilities:
 * - hasV1Routes: can create/export V1 routes
 * - hasV2Routes: can create/export V2 routes
 * - isDualUser: can create/export both V1 and V2 routes
 * - isV1Only: can ONLY create/export V1 routes
 * - isV2Only: can ONLY create/export V2 routes
 */
export function getUserRouteAccess(user: ILoggedUser | null | undefined) {
  const hasV1 = hasUserFeature(user, "v1_routes");
  const hasV2 = hasUserFeature(user, "v2_routes");

  return {
    hasV1Routes: hasV1,
    hasV2Routes: hasV2,
    isDualUser: hasV1 && hasV2,
    isV1Only: hasV1 && !hasV2,
    isV2Only: hasV2 && !hasV1,
  };
}
