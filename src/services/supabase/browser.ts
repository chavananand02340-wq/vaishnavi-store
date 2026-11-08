"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/config/env";

let client: SupabaseClient | null = null;

/**
 * One Supabase client for the whole browser tab, holding the shop team's login.
 * The phone talks straight to the Mumbai database (fast in India); Row Level
 * Security in the database decides what each person may read or change.
 * Only services/ should import this. Components call a service function instead.
 */
export function supabase(): SupabaseClient {
  if (!client) client = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}
