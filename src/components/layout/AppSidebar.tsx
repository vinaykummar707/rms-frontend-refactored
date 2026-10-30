import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@/core/auth/authStore";
import { isSuperAdmin, isRegularCustomer } from "@/core/authorization/customerTier";
import { hasUserFeature } from "@/core/authorization/featureFlags";
import { ROLES } from "@/config/constants/roles";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  BusFront,
  LayoutDashboard,
  Building2,
  Box,
  Warehouse,
  Route,
  Users,
  MapPin,
  GitBranch,
  Navigation,
  Type,
} from "lucide-react";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: readonly string[];
  features?: readonly string[];
}

interface NavSection {
  title?: string | null;
  items: NavItem[];
}

export function AppSidebar() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const userRole = user?.role?.name?.toLowerCase() || "";
  const isSuper = isSuperAdmin(user);
  const isRegular = isRegularCustomer(user);

  // Navigation Items matching navitronics-ui
  const organizationNav: NavItem[] = [
    {
      title: "Dashboard",
      url: "/home/dashboard",
      icon: LayoutDashboard,
      roles: [ROLES.ORGANIZATION_ADMIN, ROLES.REGION_ADMIN],
    },
    {
      title: "Organizations",
      url: "/home/organizations",
      icon: Building2,
      roles: [ROLES.MASTER, ROLES.GUEST],
    },
    {
      title: "Regions",
      url: "/home/regions",
      icon: Box,
      roles: [ROLES.ORGANIZATION_ADMIN],
      features: ["PIS", "PAS", "ITMS"],
    },
    {
      title: "Depots",
      url: "/home/depots",
      icon: Warehouse,
      roles: [ROLES.REGION_ADMIN, ROLES.ORGANIZATION_ADMIN, ROLES.GUEST],
      features: ["PIS", "PAS", "ITMS"],
    },
  ];

  const pisNav: NavItem[] = [
    {
      title: isSuper ? "STU Routes" : "Routes",
      url: "/home/routes",
      icon: Route,
      roles: [ROLES.DEPOT_ADMIN, ROLES.REGION_ADMIN, ROLES.ORGANIZATION_ADMIN, ROLES.GUEST],
      features: ["PIS", "PAS", "ITMS"],
    },
    {
      title: isSuper ? "STU Users" : "Users",
      url: "/home/users",
      icon: Users,
      roles: [ROLES.ORGANIZATION_ADMIN, ROLES.REGION_ADMIN],
    },
  ];

  const pasNav: NavItem[] = [
    {
      title: "Stops",
      url: "/home/stops",
      icon: MapPin,
      roles: [ROLES.DEPOT_ADMIN, ROLES.REGION_ADMIN, ROLES.ORGANIZATION_ADMIN],
      features: ["PAS", "ITMS"],
    },
    {
      title: "Route Configuration",
      url: "/home/route-configuration",
      icon: GitBranch,
      roles: [ROLES.DEPOT_ADMIN, ROLES.REGION_ADMIN, ROLES.ORGANIZATION_ADMIN, ROLES.GUEST],
      features: ["PIS", "PAS", "ITMS"],
    },
  ];

  const regularCustomerNav: NavItem[] = [
    {
      title: "Regular Routes",
      url: "/home/regular-routes",
      icon: Navigation,
      roles: [ROLES.MASTER, ROLES.USER],
    },
    {
      title: "Regular Customers",
      url: "/home/regular-customers",
      icon: Users,
      roles: [ROLES.MASTER],
    },
  ];

  const adminNav: NavItem[] = [
    {
      title: "Font Configuration",
      url: "/home/font-configuration",
      icon: Type,
      roles: [ROLES.MASTER],
    },
  ];

  // Guards matching navitronics-ui
  const canSee = (item: NavItem): boolean => {
    if (isSuper) return true;
    if (!item.roles || item.roles.length === 0) return true;
    const lowerRoles = item.roles.map((r) => r.toLowerCase());
    const hasRole = lowerRoles.includes(userRole);
    if (!hasRole) return false;
    if (!item.features || item.features.length === 0) return true;
    return item.features.some((f) => hasUserFeature(user, f));
  };

  // Section list matching navitronics-ui categorizations
  const rawSections: NavSection[] = isRegular
    ? [{ title: "Menu", items: regularCustomerNav }]
    : [
        { title: null, items: organizationNav },
        { title: "PIS", items: pisNav },
        { title: "PAS", items: pasNav },
        ...(isSuper
          ? [
              { title: "REGULAR CUSTOMERS", items: regularCustomerNav },
              { title: "ADMINISTRATOR", items: adminNav },
            ]
          : []),
      ];

  const visibleSections = rawSections
    .map((section) => ({
      ...section,
      items: section.items.filter(canSee),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      {/* Brand Header */}
      <SidebarHeader className="border-b border-sidebar-border px-3.5 py-3">
        <Link
          to="/home"
          className="flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="h-7.5 w-7.5 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
            <BusFront className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-foreground">
                Navitronix RMS
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground truncate">
              {isRegular ? "Enterprise Portal" : "STU Transit Hub"}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Nav Content Groups */}
      <SidebarContent className="gap-2 px-2 py-3">
        {visibleSections.map((section, idx) => (
          <SidebarGroup key={section.title || `section-${idx}`} className="p-0">
            {section.title && (
              <SidebarGroupLabel className="text-[10px] font-semibold text-muted-foreground/80 tracking-wider uppercase px-2 mb-0.5">
                {section.title}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    location.pathname === item.url ||
                    location.pathname.startsWith(`${item.url}/`);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        render={<Link to={item.url} />}
                        isActive={isActive}
                        tooltip={item.title}
                        className={`h-8.5 gap-2.5 rounded-lg px-2.5 text-xs transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

export default AppSidebar;