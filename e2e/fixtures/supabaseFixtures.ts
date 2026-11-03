import { createClient } from "@supabase/supabase-js";
import { testEnv } from "../config/testEnv";

/**
 * Supabase Test Utility Client
 * Used by E2E test hooks to verify database records, seed state, and perform cleanup.
 */
export const supabaseTestClient = createClient(
  testEnv.supabaseUrl,
  testEnv.supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export class SupabaseTestHelper {
  /**
   * Verifies if an organization exists in public.organizations
   */
  static async organizationExists(name: string): Promise<boolean> {
    const { data, error } = await supabaseTestClient
      .from("organizations")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (error) return false;
    return Boolean(data);
  }

  /**
   * Verifies if a user exists in public.users
   */
  static async userExists(email: string): Promise<boolean> {
    const { data, error } = await supabaseTestClient
      .from("users")
      .select("id, active, deleted")
      .eq("email", email)
      .maybeSingle();

    if (error) return false;
    return Boolean(data && !data.deleted);
  }

  /**
   * Cleans up test organizations and child records matching a test prefix
   */
  static async cleanupTestOrganizations(prefix: string) {
    try {
      const { data: orgs } = await supabaseTestClient
        .from("organizations")
        .select("id")
        .ilike("name", `${prefix}%`);

      if (orgs && orgs.length > 0) {
        const orgIds = orgs.map((o) => o.id);
        await supabaseTestClient.from("depots").delete().in("organization_id", orgIds);
        await supabaseTestClient.from("regions").delete().in("organization_id", orgIds);
        await supabaseTestClient.from("organizations").delete().in("id", orgIds);
      }
    } catch (err) {
      console.warn("Test cleanup warning:", err);
    }
  }
}

