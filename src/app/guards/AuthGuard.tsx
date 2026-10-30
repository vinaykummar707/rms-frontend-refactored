import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/core/auth/authStore";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/core/notifications/notificationService";
import { ROUTES } from "@/navigation/routes";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, user, logout } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);
  const [isSessionValid, setIsSessionValid] = useState(isAuthenticated);

  useEffect(() => {
    let isMounted = true;

    const validateSession = async () => {
      if (!isAuthenticated || !user) {
        if (isMounted) {
          setIsSessionValid(false);
          setIsValidating(false);
        }
        return;
      }

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (sessionError || !session?.user) {
          logout();
          setIsSessionValid(false);
          setIsValidating(false);
          return;
        }

        // Verify account is still active in public.users
        if (user.id) {
          const { data: dbUser, error: dbError } = await supabase
            .from("users")
            .select("active")
            .eq("id", user.id)
            .maybeSingle();

          if (!isMounted) return;

          if (!dbError && dbUser && !dbUser.active) {
            notify.error("Your account is inactive. Please contact your administrator.");
            await supabase.auth.signOut();
            logout();
            setIsSessionValid(false);
            setIsValidating(false);
            return;
          }
        }

        setIsSessionValid(true);
      } catch (err) {
        console.error("Session validation error:", err);
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    };

    validateSession();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id, logout]);

  if (!isAuthenticated || !isSessionValid) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (isValidating) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-primary" />
          <span className="text-sm text-muted-foreground">Verifying session...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

