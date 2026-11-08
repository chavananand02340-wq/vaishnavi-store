import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/config/server-env";
import { AppError } from "@/lib/errors";
import { bearer } from "@/server/http";

/**
 * Database clients for server code. The server only ever uses the public (anon) key;
 * privileged reads go through database functions that check NOTIFY_SECRET.
 * The service-role key is never used by this app.
 */
const NO_SESSION = { persistSession: false, autoRefreshToken: false } as const;

export function anonDb(): SupabaseClient {
  const e = serverEnv();
  if (!e.supabaseUrl || !e.supabaseAnonKey) throw new AppError("not_configured", "The database address isn't set up.");
  return createClient(e.supabaseUrl, e.supabaseAnonKey, { auth: NO_SESSION });
}

/** Client acting as the logged-in person whose access token came with the request. */
export function userDb(accessToken: string): SupabaseClient {
  const e = serverEnv();
  if (!e.supabaseUrl || !e.supabaseAnonKey) throw new AppError("not_configured", "The database address isn't set up.");
  return createClient(e.supabaseUrl, e.supabaseAnonKey, { auth: NO_SESSION, global: { headers: { Authorization: `Bearer ${accessToken}` } } });
}

/** Throws 401/403 unless the request comes from the shop owner. Returns a client acting as them. */
export async function requireOwner(req: Request): Promise<SupabaseClient> {
  const token = bearer(req);
  if (!token) throw new AppError("unauthorized", "Owner login required.");
  const sb = userDb(token);
  const { data } = await sb.rpc("is_owner");
  if (data !== true) throw new AppError("forbidden", "Owner login required.");
  return sb;
}
