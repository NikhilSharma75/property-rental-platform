import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Backend uses the SERVICE ROLE (secret) key — full access, bypasses Row Level Security.
// Never expose this client or key to the frontend.
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});