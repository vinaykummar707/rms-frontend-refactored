/**
 * Canonical Application Route Paths
 */
export const ROUTES = {
  ROOT: "/",
  LOGIN: "/login",
  HOME: "/home",
  
  // Dashboard & Navigation Sections
  DASHBOARD: "/home/dashboard",
  ORGANIZATIONS: "/home/organizations",
  REGIONS: "/home/regions",
  DEPOTS: "/home/depots",
  USERS: "/home/users",
  GUESTS: "/home/guests",
  ROLES: "/home/roles",
  FONTS: "/home/fonts",
  REGULAR_ROUTES: "/home/regular-routes",
  REGULAR_CUSTOMERS: "/home/regular-customers",
  ROUTES: "/home/routes",
  ROUTE_CONFIGURATION: "/home/route-configuration",
  STOPS: "/home/stops",
  SETTINGS: "/home/settings",
  UTILITY: "/home/utility",
  FONT_CONFIGURATION: "/home/font-configuration",

  // Route Creation (V2 - Regular & STU Customers)
  ROUTES_CREATE_V2: "/routes/create",
  ROUTES_CREATE_V2_ROUTE: "/routes/create/:routeId",
  ROUTES_CREATE_V2_DEPOT: "/routes/create/:areaId/:depotId",
  ROUTES_CREATE_V2_DEPOT_ROUTE: "/routes/create/:areaId/:depotId/:routeId",

  // Route Creation (V1 - Regular & STU Customers)
  ROUTES_CREATE_V1: "/routes/create-v1",
  ROUTES_CREATE_V1_ROUTE: "/routes/create-v1/:routeId",
  ROUTES_CREATE_V1_DEPOT: "/routes/create-v1/:areaId/:depotId",
  ROUTES_CREATE_V1_DEPOT_ROUTE: "/routes/create-v1/:areaId/:depotId/:routeId",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

