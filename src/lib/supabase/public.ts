import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side, cookie-free client for PUBLIC data only (catalogue, settings).
 * Because it reads no cookies, pages that use it can be cached on the CDN.
 */
export function publicSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
