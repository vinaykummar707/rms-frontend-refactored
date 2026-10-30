import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/core/auth/authStore";
import { supabase } from "@/integrations/supabase/client";
import { ROUTES } from "@/navigation/routes";

interface PublicGuardProps {
  children: ReactNode;
}

export function PublicGuard({ children }: PublicGuardProps) {
  const { isAuthenticated, logout } = useAuthStore();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      if (!isAuthenticated) {
        if (isMounted) {
          setShouldRedirect(false);
          setChecking(false);
        }
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (!session?.user) {
          logout();
          setShouldRedirect(false);
        } else {
          setShouldRedirect(true);
        }
      } catch {
        if (isMounted) setShouldRedirect(false);
      } finally {
        if (isMounted) setChecking(false);
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, logout]);

  if (checking) {
    return null;
  }

  if (shouldRedirect) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <>{children}</>;
}

