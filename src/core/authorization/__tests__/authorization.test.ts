import { describe, it, expect } from "vitest";
import {
  isSuperAdmin,
  isRegularCustomer,
  isSTUCustomer,
  getCustomerTier,
  getDefaultRouteForUser,
} from "../customerTier";
import { hasUserFeature, getUserRouteAccess } from "../featureFlags";
import { canAccessRole, canAccessModule, canCreateUserOfRole } from "../permissions";
import { ROLES } from "@/config/constants/roles";
import type { ILoggedUser } from "@/shared/types/user";

describe("Customer Tier & Authorization", () => {
  const superAdminUser = {
    id: "admin-1",
    user_id: "auth-1",
    email: "super@navitronix.com",
    role: { id: "r-1", name: "super_admin" },
    customer_type: "stu",
  } as unknown as ILoggedUser;

  const regularCustomerUser = {
    id: "reg-1",
    user_id: "auth-2",
    email: "client@transport.com",
    role: { id: "r-2", name: "user" },
    customer_type: "regular",
    organization_id: null,
    depot_id: null,
    v1_routes: true,
    v2_routes: false,
  } as unknown as ILoggedUser;

  const stuDepotAdminUser = {
    id: "stu-1",
    user_id: "auth-3",
    email: "depot@ksrtc.gov.in",
    role: { id: "r-3", name: "depot_admin" },
    customer_type: "stu",
    organization_id: "org-1",
    depot_id: "depot-1",
    features: ["PIS", "PAS"],
    v1_routes: true,
    v2_routes: true,
  } as unknown as ILoggedUser;

  it("accurately identifies super_admin / master role", () => {
    expect(isSuperAdmin(superAdminUser)).toBe(true);
    expect(isSuperAdmin(regularCustomerUser)).toBe(false);
    expect(isSuperAdmin(stuDepotAdminUser)).toBe(false);
  });

  it("accurately detects customer tier (regular vs STU)", () => {
    expect(getCustomerTier(regularCustomerUser)).toBe("regular");
    expect(getCustomerTier(stuDepotAdminUser)).toBe("stu");
    expect(isRegularCustomer(regularCustomerUser)).toBe(true);
    expect(isSTUCustomer(stuDepotAdminUser)).toBe(true);
  });

  it("determines default landing route per role and customer tier", () => {
    expect(getDefaultRouteForUser(superAdminUser)).toBe("/home/dashboard");
    expect(getDefaultRouteForUser(regularCustomerUser)).toBe("/home/regular-routes");
    expect(getDefaultRouteForUser(stuDepotAdminUser)).toBe("/home/routes");
  });

  it("evaluates feature flags and route access correctly", () => {
    expect(hasUserFeature(stuDepotAdminUser, "PIS")).toBe(true);
    expect(hasUserFeature(stuDepotAdminUser, "ITMS")).toBe(false);
    expect(hasUserFeature(superAdminUser, "ANYTHING")).toBe(true); // Super Admin bypass

    const regRouteAccess = getUserRouteAccess(regularCustomerUser);
    expect(regRouteAccess.hasV1Routes).toBe(true);
    expect(regRouteAccess.hasV2Routes).toBe(false);
    expect(regRouteAccess.isDualUser).toBe(false);

    const stuRouteAccess = getUserRouteAccess(stuDepotAdminUser);
    expect(stuRouteAccess.hasV1Routes).toBe(true);
    expect(stuRouteAccess.hasV2Routes).toBe(true);
    expect(stuRouteAccess.isDualUser).toBe(true);
  });

  it("enforces RBAC permissions across module, role, and user creation boundaries", () => {
    // Super admin can access master-permitted routes and create lower roles
    expect(canAccessModule(superAdminUser, "PIS")).toBe(true);
    expect(canAccessRole(superAdminUser, [ROLES.MASTER, ROLES.ORGANIZATION_ADMIN])).toBe(true);
    expect(canCreateUserOfRole(superAdminUser, ROLES.ORGANIZATION_ADMIN)).toBe(true);
    expect(canCreateUserOfRole(superAdminUser, ROLES.USER)).toBe(true);

    // Organization admin can create region admin and depot admin, but not organization admin
    const orgAdminUser = {
      id: "org-1",
      user_id: "auth-4",
      email: "org@ksrtc.gov.in",
      role: { id: "r-4", name: "organization_admin" },
      customer_type: "stu",
      organization_id: "org-1",
    } as unknown as ILoggedUser;
    expect(canCreateUserOfRole(orgAdminUser, ROLES.REGION_ADMIN)).toBe(true);
    expect(canCreateUserOfRole(orgAdminUser, ROLES.DEPOT_ADMIN)).toBe(true);
    expect(canCreateUserOfRole(orgAdminUser, ROLES.ORGANIZATION_ADMIN)).toBe(false);

    // Depot admin cannot create administrative users
    expect(canCreateUserOfRole(stuDepotAdminUser, ROLES.ORGANIZATION_ADMIN)).toBe(false);
    expect(canCreateUserOfRole(stuDepotAdminUser, ROLES.DEPOT_ADMIN)).toBe(false);
    expect(canCreateUserOfRole(stuDepotAdminUser, ROLES.USER)).toBe(false);
  });
});
