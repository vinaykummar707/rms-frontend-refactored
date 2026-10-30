import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { useAuthStore } from "@/core/auth/authStore";
import { PROTECTED_ROUTES_METADATA } from "@/navigation/metadata";
import { isSuperAdmin, isRegularCustomer } from "@/core/authorization/customerTier";
import { hasUserFeature } from "@/core/authorization/featureFlags";
import { ROLES } from "@/config/constants/roles";

export function HomeLayoutPlaceholder() {
  const { signOut } = useAuth();
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  const userRole = user?.role?.name?.toLowerCase();
  const isSuper = isSuperAdmin(user);
  const isRegular = isRegularCustomer(user);

  // Filter accessible routes for navigation bar
  const visibleRoutes = PROTECTED_ROUTES_METADATA.filter((route) => {
    if (!route.isNavMenu) return false;

    const lowerRoles = route.roles.map((r) => r.toLowerCase());
    let hasRole = false;
    if (route.roles.length === 0) {
      hasRole = true;
    } else if (isSuper && lowerRoles.includes(ROLES.MASTER)) {
      hasRole = true;
    } else if (isRegular && (lowerRoles.includes(ROLES.USER) || lowerRoles.includes("regular"))) {
      hasRole = true;
    } else if (userRole && lowerRoles.includes(userRole)) {
      hasRole = true;
    }

    if (!hasRole) return false;

    if (route.features.length > 0) {
      return route.features.some((f) => hasUserFeature(user, f));
    }

    return true;
  });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight">Navitronix RMS</span>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Refactored
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1 overflow-x-auto py-1">
            {visibleRoutes.map((r) => {
              const fullPath = `/home/${r.path}`;
              const isActive = location.pathname === fullPath;
              return (
                <Link
                  key={r.path}
                  to={fullPath}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {r.title}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right text-xs">
            <span className="font-semibold text-foreground">{user?.email}</span>
            <span className="text-[10px] text-muted-foreground">
              {user?.role?.name || "User"} • {isRegular ? "Regular" : "STU"}
            </span>
          </div>
          <button
            onClick={() => signOut()}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Outlet Container */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}

