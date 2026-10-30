import { supabase, supabaseAuthHelper } from "@/integrations/supabase/client";
import { checkActiveDuplicate } from "@/shared/hooks/useCrud";
import type { IOrganization } from "@/shared/types/organization";

export interface STUProvisioningPayload {
  organization: {
    name: string;
    email: string;
    phone: string;
    logo?: string | null;
    PIS: boolean;
    PAS: boolean;
    ITMS: boolean;
    v1_routes: boolean;
    v2_routes: boolean;
  };
  regions: string[];
  depots: { name: string; regionName: string }[];
  adminUser: {
    email: string;
    password: string;
  };
}

export async function checkOrganizationNameDuplicate(
  name: string,
  excludeId?: string
): Promise<boolean> {
  return checkActiveDuplicate("organizations", "name", name, undefined, excludeId);
}

export async function checkOrganizationEmailDuplicate(
  email: string,
  excludeId?: string
): Promise<boolean> {
  return checkActiveDuplicate("organizations", "email", email, undefined, excludeId);
}

/**
 * Executes the complete transactional provisioning journey for an STU organization:
 * 1. Inserts the organization record
 * 2. Creates the assigned regions
 * 3. Creates the assigned depots mapped to their regions
 * 4. Obtains the 'organization_admin' role ID
 * 5. Creates or reclaims the admin user in Supabase Auth & public.users
 * 6. Cleans up created entities if any error occurs
 */
export async function provisionSTUOrganization(
  payload: STUProvisioningPayload
): Promise<{ organization: IOrganization; adminUserId: string }> {
  const { organization, regions, depots, adminUser } = payload;
  const trimmedOrgName = organization.name.trim();
  const trimmedOrgEmail = organization.email.trim();
  const trimmedAdminEmail = adminUser.email.trim();

  // 1. Pre-validation duplicate checks
  const { data: nameCheck } = await supabase
    .from("organizations")
    .select("id")
    .ilike("name", trimmedOrgName)
    .maybeSingle();

  if (nameCheck) {
    throw new Error(`An organization named "${trimmedOrgName}" already exists.`);
  }

  const { data: emailCheck } = await supabase
    .from("organizations")
    .select("id")
    .ilike("email", trimmedOrgEmail)
    .maybeSingle();

  if (emailCheck) {
    throw new Error(`An organization with email "${trimmedOrgEmail}" already exists.`);
  }

  // Check if admin user is already registered in public.users to another active organization
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, organization_id, password, deleted")
    .eq("email", trimmedAdminEmail)
    .maybeSingle();

  if (existingUser && existingUser.organization_id && !existingUser.deleted) {
    throw new Error(
      `A user with email "${trimmedAdminEmail}" is already registered to another organization.`
    );
  }

  let createdOrgId: string | null = null;

  try {
    // 2. Insert Organization
    const { data: orgRecord, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: trimmedOrgName,
        email: trimmedOrgEmail,
        phone: organization.phone.trim(),
        logo: organization.logo?.trim() || null,
        PIS: organization.PIS,
        PAS: organization.PAS,
        ITMS: organization.ITMS,
        v1_routes: organization.v1_routes,
        v2_routes: organization.v2_routes,
        customer_type: "stu",
        active: true,
      })
      .select()
      .single();

    if (orgError || !orgRecord) {
      throw new Error(orgError?.message || "Failed to create organization");
    }

    createdOrgId = orgRecord.id;
    const orgId = orgRecord.id;

    // 3. Insert Regions
    const regionIdMap: Record<string, string> = {};
    for (const regionName of regions) {
      const { data: regRecord, error: regError } = await supabase
        .from("regions")
        .insert({
          name: regionName.trim(),
          organization_id: orgId,
        })
        .select()
        .single();

      if (regError || !regRecord) {
        throw new Error(
          `Failed to create region "${regionName}": ${regError?.message || "Unknown error"}`
        );
      }
      regionIdMap[regionName] = regRecord.id;
    }

    // 4. Insert Depots
    for (const depot of depots) {
      const targetRegionId = regionIdMap[depot.regionName];
      if (!targetRegionId) {
        throw new Error(
          `Region "${depot.regionName}" could not be matched for depot "${depot.name}"`
        );
      }
      const { error: depotError } = await supabase.from("depots").insert({
        name: depot.name.trim(),
        region_id: targetRegionId,
        organization_id: orgId,
      });

      if (depotError) {
        throw new Error(
          `Failed to create depot "${depot.name}": ${depotError?.message || "Unknown error"}`
        );
      }
    }

    // 5. Fetch Role ID for organization_admin
    const { data: roleRecord } = await supabase
      .from("roles")
      .select("id")
      .ilike("name", "organization_admin")
      .maybeSingle();

    const orgAdminRoleId = roleRecord?.id || null;

    // 6. Auth User Setup using isolated supabaseAuthHelper
    const reclaimExistingAuthUser = async (): Promise<string> => {
      const { data: signInData } = await supabaseAuthHelper.auth.signInWithPassword({
        email: trimmedAdminEmail,
        password: adminUser.password,
      });
      if (signInData?.user?.id) return signInData.user.id;

      const isLeftover =
        existingUser && (existingUser.deleted || !existingUser.organization_id);
      if (isLeftover && existingUser.password) {
        const { data: oldSignIn } = await supabaseAuthHelper.auth.signInWithPassword({
          email: trimmedAdminEmail,
          password: existingUser.password,
        });
        if (oldSignIn?.user?.id) {
          const { error: pwError } = await supabaseAuthHelper.auth.updateUser({
            password: adminUser.password,
          });
          if (pwError) {
            throw new Error(`Failed to reset admin password: ${pwError.message}`);
          }
          return oldSignIn.user.id;
        }
      }

      throw new Error(
        "Admin email is already registered in authentication. Please verify password or use a different email."
      );
    };

    let authUserId = "";
    const { data: signUpData, error: signUpError } =
      await supabaseAuthHelper.auth.signUp({
        email: trimmedAdminEmail,
        password: adminUser.password,
        options: {
          data: {
            organization_id: orgId,
            customer_type: "stu",
            v1_routes: organization.v1_routes,
            v2_routes: organization.v2_routes,
          },
        },
      });

    if (
      signUpError ||
      (signUpData?.user &&
        (!signUpData.user.identities || signUpData.user.identities.length === 0))
    ) {
      authUserId = await reclaimExistingAuthUser();
      await supabaseAuthHelper.auth.signOut();
    } else if (signUpData?.user?.id) {
      authUserId = signUpData.user.id;
    }

    if (!authUserId) {
      throw new Error("Unable to obtain authenticated user ID for administrator");
    }

    // 7. Upsert record into public.users
    if (existingUser) {
      const { error: userUpdateError } = await supabase
        .from("users")
        .update({
          user_id: authUserId,
          password: adminUser.password,
          organization_id: orgId,
          role_id: orgAdminRoleId,
          customer_type: "stu",
          active: true,
          deleted: false,
          v1_routes: organization.v1_routes,
          v2_routes: organization.v2_routes,
        })
        .eq("id", existingUser.id);

      if (userUpdateError) {
        throw new Error(
          `Failed to assign user to organization: ${userUpdateError.message}`
        );
      }
    } else {
      const { error: userInsertError } = await supabase.from("users").insert({
        email: trimmedAdminEmail,
        user_id: authUserId,
        password: adminUser.password,
        organization_id: orgId,
        role_id: orgAdminRoleId,
        customer_type: "stu",
        active: true,
        v1_routes: organization.v1_routes,
        v2_routes: organization.v2_routes,
      });

      if (userInsertError) {
        throw new Error(
          `Failed to create admin user record: ${userInsertError.message}`
        );
      }
    }

    return {
      organization: orgRecord as IOrganization,
      adminUserId: authUserId,
    };
  } catch (err: any) {
    // Rollback cleanup if provisioning failed midway
    if (createdOrgId) {
      try {
        await supabase.from("depots").delete().eq("organization_id", createdOrgId);
        await supabase.from("regions").delete().eq("organization_id", createdOrgId);
        await supabase.from("organizations").delete().eq("id", createdOrgId);
      } catch (cleanupErr) {
        console.warn("Failed to clean up orphaned organization during rollback:", cleanupErr);
      }
    }
    throw err;
  }
}

/**
 * Cascades organization deletion by detaching assigned users, deleting child depots/regions,
 * and deleting the organization record.
 */
export async function deleteOrganizationCascade(orgId: string): Promise<void> {
  // 1. Detach associated users so their accounts remain clean
  const { error: detachError } = await supabase
    .from("users")
    .update({
      organization_id: null,
      region_id: null,
      depot_id: null,
      deleted: true,
      active: false,
    })
    .eq("organization_id", orgId);

  if (detachError) {
    console.warn("User detach warning:", detachError);
  }

  // 2. Remove child depots and regions
  await supabase.from("depots").delete().eq("organization_id", orgId);
  await supabase.from("regions").delete().eq("organization_id", orgId);

  // 3. Delete the organization
  const { error: deleteError } = await supabase
    .from("organizations")
    .delete()
    .eq("id", orgId);

  if (deleteError) {
    throw new Error(`Failed to delete organization: ${deleteError.message}`);
  }
}


