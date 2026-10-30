import { supabase } from "@/integrations/supabase/client";
import type { ILoggedUser } from "@/shared/types/user";
import { isSuperAdmin, isRegularCustomer } from "@/core/authorization/customerTier";
import { useAuthStore } from "./authStore";

const REMEMBERED_EMAIL_KEY = "navitronix-remembered-email";

export function readRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export function writeRememberedEmail(email: string | null): void {
  try {
    if (email) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {
    // Ignore storage access errors
  }
}

export async function fetchUserProfile(
  authUserId: string
): Promise<ILoggedUser | null> {
  const { data: dbUser, error: dbError } = await supabase
    .from("users")
    .select(
      `
      *,
      region:region_id (*),
      organization:organization_id (*),
      depot:depot_id (*),
      role:role_id (*)
    `
    )
    .eq("user_id", authUserId)
    .maybeSingle();

  if (dbError) {
    throw new Error(`Failed to load user profile: ${dbError.message}`);
  }

  return (dbUser as ILoggedUser) || null;
}

export interface SignInResult {
  user: ILoggedUser;
  defaultRoute: string;
}

export async function signInWithPassword(
  email: string,
  password: string,
  rememberMe: boolean = true
): Promise<ILoggedUser> {
  const trimmedEmail = email.trim();

  // 1. Authenticate with Supabase Auth
  const { data: authData, error: supaError } =
    await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

  if (supaError) {
    throw new Error(supaError.message || "Invalid email or password");
  }

  if (!authData?.user) {
    throw new Error("Authentication failed. No user returned from server.");
  }

  writeRememberedEmail(rememberMe ? trimmedEmail : null);

  // 2. Fetch user profile from public.users with joined relations
  const userData = await fetchUserProfile(authData.user.id);
  if (!userData) {
    throw new Error(
      "Your account profile is not found in the users table. Please contact support at support@navitronix.in or reach your administrator."
    );
  }

  // 3. Active status check
  if (!userData.active) {
    throw new Error(
      "Your account is inactive. Please contact support at support@navitronix.in."
    );
  }

  // 4. Hydrate auth user metadata
  try {
    const meta = authData.user.user_metadata;
    if (meta) {
      if (
        meta.v1_routes !== undefined &&
        (userData.v1_routes === undefined || userData.v1_routes === null)
      ) {
        userData.v1_routes = meta.v1_routes;
      }
      if (
        meta.v2_routes !== undefined &&
        (userData.v2_routes === undefined || userData.v2_routes === null)
      ) {
        userData.v2_routes = meta.v2_routes;
      }
      if (meta.customer_type && !userData.customer_type) {
        userData.customer_type = meta.customer_type;
      }
      if (meta.PIS !== undefined) userData.PIS = meta.PIS;
      if (meta.PAS !== undefined) userData.PAS = meta.PAS;
      if (meta.ITMS !== undefined) userData.ITMS = meta.ITMS;
    }
  } catch (metaErr) {
    console.warn("Could not fetch auth metadata:", metaErr);
  }

  const roleName = userData.role?.name?.toLowerCase();

  // 5. STU Enterprise Users validation: organization must be active
  if (!isSuperAdmin(userData) && !isRegularCustomer(userData) && roleName !== "guest") {
    if (!userData.organization || userData.organization.active === false) {
      throw new Error(
        "Your organization account is inactive. Please contact support at support@navitronix.in."
      );
    }
  }

  useAuthStore.getState().login(userData);
  return userData;
}

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Supabase signOut error:", err);
  } finally {
    useAuthStore.getState().logout();
  }
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) {
    throw new Error(error.message || "An error occurred while resetting password.");
  }
}

export async function validateCurrentSession(): Promise<{
  isValid: boolean;
  user: ILoggedUser | null;
}> {
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return { isValid: false, user: null };
    }

    const cachedUser = useAuthStore.getState().user;
    if (cachedUser?.id) {
      const { data: dbUser, error: dbError } = await supabase
        .from("users")
        .select("active")
        .eq("id", cachedUser.id)
        .maybeSingle();

      if (!dbError && dbUser && !dbUser.active) {
        await signOut();
        return { isValid: false, user: null };
      }
    }

    return { isValid: true, user: cachedUser };
  } catch (err) {
    console.error("Session validation error:", err);
    return { isValid: false, user: null };
  }
}

