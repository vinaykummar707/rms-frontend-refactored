import { supabase, supabaseAuthHelper } from "@/integrations/supabase/client";
import { confirmUserDelete } from "@/shared/utils/deleteImpact";
import type { IUser } from "@/shared/types/user";

export interface ProvisionUserInput {
  email: string;
  password?: string;
  role_id: string;
  roleName?: string;
  organization_id?: string | null;
  region_id?: string | null;
  depot_id?: string | null;
  active?: boolean;
  customer_type?: "regular" | "stu";
  v1_routes?: boolean;
  v2_routes?: boolean;
  PIS?: boolean;
  PAS?: boolean;
  ITMS?: boolean;
}

/**
 * Validates the strict 1:1 hierarchy uniqueness check:
 * - Only 1 organization_admin per organization
 * - Only 1 region_admin per region
 * - Only 1 depot_admin per depot
 */
export async function checkHierarchyUniqueness(
  roleName: string,
  targetScope: {
    organizationId?: string | null;
    regionId?: string | null;
    depotId?: string | null;
    roleId?: string | null;
  },
  excludeUserId?: string
): Promise<boolean> {
  const lowerRole = (roleName || "").toLowerCase().trim().replace(/[\s-]+/g, "_");

  // Determine targetRoleId if not directly supplied
  let targetRoleId = targetScope.roleId;
  if (!targetRoleId) {
    const { data: roleData } = await supabase
      .from("roles")
      .select("id")
      .or(`name.eq.${lowerRole},name.ilike.${lowerRole.replace(/_/g, " ")}`)
      .maybeSingle();
    targetRoleId = roleData?.id || null;
  }

  if (
    (lowerRole === "organization_admin" || lowerRole === "org_admin") &&
    targetScope.organizationId
  ) {
    let query = supabase
      .from("users")
      .select("id")
      .eq("organization_id", targetScope.organizationId);

    if (targetRoleId) {
      query = query.eq("role_id", targetRoleId);
    }
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("checkHierarchyUniqueness org admin query error:", error);
      return false;
    }
    return Boolean(data && data.length > 0);
  }

  if (
    (lowerRole === "region_admin" || lowerRole === "area_admin") &&
    targetScope.regionId
  ) {
    let query = supabase
      .from("users")
      .select("id")
      .eq("region_id", targetScope.regionId);

    if (targetRoleId) {
      query = query.eq("role_id", targetRoleId);
    }
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("checkHierarchyUniqueness region admin query error:", error);
      return false;
    }
    return Boolean(data && data.length > 0);
  }

  if (lowerRole === "depot_admin" && targetScope.depotId) {
    let query = supabase
      .from("users")
      .select("id")
      .eq("depot_id", targetScope.depotId);

    if (targetRoleId) {
      query = query.eq("role_id", targetRoleId);
    }
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("checkHierarchyUniqueness depot admin query error:", error);
      return false;
    }
    return Boolean(data && data.length > 0);
  }

  return false;
}

/**
 * Creates a new user in Supabase Auth via supabaseAuthHelper and public.users
 */
export async function provisionUser(
  input: ProvisionUserInput
): Promise<IUser> {
  const trimmedEmail = input.email.trim();

  // 1. Check if user with this email already exists in public.users
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("email", trimmedEmail)
    .maybeSingle();

  if (existingUser && existingUser.organization_id) {
    throw new Error(
      `A user with email "${trimmedEmail}" is already registered in the system.`
    );
  }

  let authUserId = "";
  if (input.password) {
    const { data: signUpData, error: signUpError } =
      await supabaseAuthHelper.auth.signUp({
        email: trimmedEmail,
        password: input.password,
        options: {
          data: {
            organization_id: input.organization_id || null,
            customer_type: input.customer_type || "stu",
            v1_routes: input.v1_routes ?? false,
            v2_routes: input.v2_routes ?? true,
          },
        },
      });

    if (signUpError) {
      throw new Error(`Authentication sign up failed: ${signUpError.message}`);
    }

    if (signUpData?.user?.id) {
      authUserId = signUpData.user.id;
    }
  }

  if (!authUserId) {
    throw new Error("Unable to obtain authenticated user ID");
  }

  // 2. Insert into public.users
  const insertPayload: Record<string, any> = {
    email: trimmedEmail,
    user_id: authUserId,
    password: input.password || null,
    organization_id: input.organization_id || null,
    region_id: input.region_id || null,
    depot_id: input.depot_id || null,
    role_id: input.role_id,
    active: input.active ?? true,
    customer_type: input.customer_type || "stu",
    v1_routes: input.v1_routes ?? false,
    v2_routes: input.v2_routes ?? true,
    PIS: input.PIS ?? true,
    PAS: input.PAS ?? false,
    ITMS: input.ITMS ?? false,
  };

  let { data: userRecord, error: insertError } = await supabase
    .from("users")
    .insert(insertPayload)
    .select()
    .single();

  if (insertError && (insertError.code === "PGRST204" || insertError.code === "42703")) {
    const { PIS, PAS, ITMS, ...fbPayload } = insertPayload;
    const res = await supabase.from("users").insert(fbPayload).select().single();
    userRecord = res.data;
    insertError = res.error;
  }

  if (insertError || !userRecord) {
    throw new Error(`Failed to create database user record: ${insertError?.message || "Unknown error"}`);
  }

  return userRecord as IUser;
}

export async function sendUserPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) {
    throw new Error(error.message || "Failed to send password reset email");
  }
}

export { confirmUserDelete };
