import { createClient } from "@supabase/supabase-js";

// Frontend uses the PUBLISHABLE (anon) key only — safe to expose to the browser.
// All privileged writes go through our backend API instead.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);