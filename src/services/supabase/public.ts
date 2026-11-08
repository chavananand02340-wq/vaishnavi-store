import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabase, publicEnv } from "@/config/env";

/**
 * Cookie-free client for PUBLIC data (catalogue, settings, order tracking by token).
 * Because it reads no cookies, server pages that use it can be cached on the CDN.
 * Returns null if the database address isn't configured (e.g. a CI build).
 */
export function publicSupabase(): SupabaseClient | null {
  if (!hasSupabase) return null;
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
