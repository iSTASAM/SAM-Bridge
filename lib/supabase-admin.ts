import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function getSupabaseAdmin() {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) {
    client = null;
    return null;
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
