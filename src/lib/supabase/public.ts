import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "../env";

let client: SupabaseClient | null = null;

/** Cliente anônimo, sem cookies: lê apenas o que o RLS libera para a vitrine. */
export function createPublicClient() {
  client ??= createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
