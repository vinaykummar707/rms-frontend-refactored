import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "../guards/AuthGuard";
import { PublicGuard } from "../guards/PublicGuard";
import { RoleGuard } from "../guards/RoleGuard";
import { LoginPage } from "@/pages/auth/LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import { OrganizationsPage } from "@/pages/organizations/OrganizationsPage";
import { RoutePlaceholder } from "./RoutePlaceholder";
import { ROUTES } from "@/navigation/routes";
import {
  PROTECTED_ROUTES_METADATA,
  EDITOR_ROUTES_METADATA,
} from "@/navigation/metadata";
import { getDefaultRouteForUser } from "@/core/authorization/customerTier";
import { useAuthStore } from "@/core/auth/authStore";

export function AppRouter() {
  const user = useAuthStore((state) => state.user);

  return (
    <Routes>
      {/* Root Redirect */}
      <Route path={ROUTES.ROOT} element={<Navigate to={ROUTES.HOME} replace />} />

      {/* Public Routes */}
      <Route
        path={ROUTES.LOGIN}
        element={
          <PublicGuard>
            <LoginPage />
          </PublicGuard>
        }
      />

      {/* Standalone Route Editor Paths (V1 & V2) */}
      {EDITOR_ROUTES_METADATA.map((editorRoute) => (
        <Route
          key={editorRoute.path}
          path={editorRoute.path}
          element={
            <AuthGuard>
              <RoleGuard
                roles={editorRoute.roles}
                features={editorRoute.features}
              >
                <RoutePlaceholder
                  title={editorRoute.title}
                  path={editorRoute.path}
                  description={editorRoute.description}
                  roles={editorRoute.roles}
                />
              </RoleGuard>
            </AuthGuard>
          }
        />
      ))}

      {/* Main Protected Application Section */}
      <Route
        path={ROUTES.HOME}
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        {/* Dynamic Default Landing based on user customer tier & role */}
        <Route
          index
          element={<Navigate to={getDefaultRouteForUser(user)} replace />}
        />

        {/* Organizations Page - Fully implemented with Cards Grid */}
        <Route
          path="organizations"
          element={
            <RoleGuard
              roles={
                PROTECTED_ROUTES_METADATA.find((r) => r.path === "organizations")
                  ?.roles || []
              }
              features={
                PROTECTED_ROUTES_METADATA.find((r) => r.path === "organizations")
                  ?.features || []
              }
            >
              <OrganizationsPage />
            </RoleGuard>
          }
        />

        {/* Other Protected Route Boundaries */}
        {PROTECTED_ROUTES_METADATA.filter(
          (routeMeta) => routeMeta.path !== "organizations"
        ).map((routeMeta) => (
          <Route
            key={routeMeta.path}
            path={routeMeta.path}
            element={
              <RoleGuard
                roles={routeMeta.roles}
                features={routeMeta.features}
              >
                <RoutePlaceholder
                  title={routeMeta.title}
                  path={`/home/${routeMeta.path}`}
                  description={routeMeta.description}
                  roles={routeMeta.roles}
                />
              </RoleGuard>
            }
          />
        ))}
      </Route>

      {/* Catch-all Not Found */}
      <Route
        path="*"
        element={
          <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
            <h1 className="text-3xl font-bold">404 - Page Not Found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The requested route does not exist.
            </p>
            <a
              href={ROUTES.HOME}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              Return Home
            </a>
          </div>
        }
      />
    </Routes>
  );
}

export default AppRouter;
