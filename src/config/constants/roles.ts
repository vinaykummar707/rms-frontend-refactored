export const ROLES = {
  MASTER: "master",
  SUPER_ADMIN: "master",
  ORGANIZATION_ADMIN: "organization_admin",
  AREA_ADMIN: "area_admin",
  REGION_ADMIN: "region_admin",
  DEPOT_ADMIN: "depot_admin",
  USER: "user",
  GUEST: "guest",
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];
export type UserRole = RoleType;

export const ROLE_LABELS: Record<string, string> = {
  master: "Super Admin",
  super_admin: "Super Admin",
  organization_admin: "Organization Admin",
  area_admin: "Area Admin",
  region_admin: "Region Admin",
  depot_admin: "Depot Admin",
  user: "User",
  guest: "Guest",
};

export const getRoleLabel = (roleName?: string | null): string => {
  if (!roleName) return "—";
  const lower = roleName.toLowerCase();
  if (ROLE_LABELS[lower]) return ROLE_LABELS[lower];
  if (lower === "master") return "Super Admin";
  return roleName
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export const getUserCreationRoleLabel = (roleName?: string | null): string => {
  const baseLabel = getRoleLabel(roleName);
  return baseLabel.replace(/\bAdmin\b/g, "User");
};
