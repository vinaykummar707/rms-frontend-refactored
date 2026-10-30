import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

export const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

/**
 * Isolated Supabase client that does not persist session or overwrite
 * the current admin's localStorage session when creating/signing up other users.
 */
export const supabaseAuthHelper = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

