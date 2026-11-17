import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the public anon key and NO session, so guest-facing calls
 * always run as `anon` (only the security-definer beehive_guest_* functions work).
 */
export function createAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
