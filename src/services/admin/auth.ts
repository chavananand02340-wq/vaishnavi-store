"use client";

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase/browser";
import { AppError } from "@/lib/errors";

/** Shop team login (owner / counter staff). The database decides access with Row Level Security. */

export type Role = "owner" | "staff";
export type Member = { user: User; role: Role; name: string };

/** Panel each role lands on after login. */
export const homeFor = (role: Role) => (role === "owner" ? "/admin" : "/staff");

async function memberRow(userId: string) {
  const { data, error } = await supabase().from("admin_users").select("role, display_name, is_active").eq("user_id", userId).maybeSingle();
  if (error) throw new AppError("network", "Couldn't reach the database. Check your internet and refresh.", { cause: error });
  return data as { role: Role; display_name: string | null; is_active: boolean } | null;
}

/**
 * The person logged in on this phone, or null if nobody is.
 * Throws "forbidden" (and signs out) if the account was removed from the team.
 */
export async function currentMember(): Promise<Member | null> {
  const { data } = await supabase().auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const row = await memberRow(user.id);
  if (!row?.is_active) {
    await signOut();
    throw new AppError("forbidden", "This account doesn't have access. Ask the shop owner.");
  }
  return { user, role: row.role, name: row.display_name ?? user.email ?? "" };
}

export async function signIn(email: string, password: string): Promise<Member> {
  const { data, error } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) {
    throw error?.message?.toLowerCase().includes("fetch")
      ? new AppError("network", "No internet connection. Try again.", { cause: error })
      : new AppError("unauthorized", "Wrong email or password.", { cause: error });
  }
  const member = await currentMember();
  if (!member) throw new AppError("unauthorized", "Wrong email or password.");
  return member;
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut().catch(() => {});
}

/** Calls `fn` when the login ends (signed out here or in another tab). Returns unsubscribe. */
export function onSignedOut(fn: () => void): () => void {
  const { data } = supabase().auth.onAuthStateChange((event) => event === "SIGNED_OUT" && fn());
  return () => data.subscription.unsubscribe();
}

/** "Bearer …" header for our own owner-only API routes. */
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Tell the CDN to refresh store pages now (owner only; fire and forget). */
export async function refreshStorefront(): Promise<void> {
  try {
    const headers = await authHeader();
    if (!headers.Authorization) return;
    void fetch("/api/revalidate", { method: "POST", headers, keepalive: true }).catch(() => {});
  } catch {
    /* the store refreshes on its own within 15 minutes */
  }
}

/** Owner-only system check (database, payments, emails). `email` sends a test email instead. */
export async function runSystemCheck(email = false): Promise<{ ok: boolean; checks?: Record<string, { ok: boolean; note: string }>; message?: string }> {
  try {
    const r = await fetch(`/api/health${email ? "?email=1" : ""}`, { headers: await authHeader(), cache: "no-store" });
    const body = (await r.json()) as { ok: boolean; checks?: Record<string, { ok: boolean; note: string }>; message?: string; error?: { message?: string } };
    return { ...body, message: body.message ?? body.error?.message };
  } catch {
    return { ok: false, message: "No reply from the website." };
  }
}
