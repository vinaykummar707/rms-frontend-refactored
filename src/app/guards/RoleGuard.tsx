import type { ReactNode } from "react";
import { useAuthStore } from "@/core/auth/authStore";
import { isSuperAdmin, isRegularCustomer } from "@/core/authorization/customerTier";
import { hasUserFeature } from "@/core/authorization/featureFlags";
import { ROLES, type UserRole } from "@/config/constants/roles";

interface RoleGuardProps {
  roles?: readonly (UserRole | string)[];
  features?: readonly string[];
  children: ReactNode;
}

export function RoleGuard({ roles = [], features = [], children }: RoleGuardProps) {
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role?.name?.toLowerCase();
  const lowerRoles = roles.map((r) => r.toLowerCase());

  const isSuper = isSuperAdmin(user);
  const isRegular = isRegularCustomer(user);

  let hasRoleAccess = false;
  if (roles.length === 0) {
    hasRoleAccess = true;
  } else if (isSuper && lowerRoles.includes(ROLES.MASTER)) {
    hasRoleAccess = true;
  } else if (isRegular && (lowerRoles.includes(ROLES.USER) || lowerRoles.includes("regular"))) {
    hasRoleAccess = true;
  } else if (userRole && lowerRoles.includes(userRole)) {
    hasRoleAccess = true;
  }

  const hasFeatureAccess =
    !features || features.length === 0
      ? true
      : features.some((f) => hasUserFeature(user, f));

  if (!hasRoleAccess || !hasFeatureAccess) {
    return (
      <div className="flex h-full w-full min-h-[300px] flex-col items-center justify-center gap-2 p-6 text-center">
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground">
          You do not have permission to view this content or feature.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

