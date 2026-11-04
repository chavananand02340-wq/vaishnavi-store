import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-only helpers for Razorpay. Never import this from a "use client" file. */

export function env() {
  return {
    keyId: (process.env.RAZORPAY_KEY_ID ?? "").trim(),
    keySecret: (process.env.RAZORPAY_KEY_SECRET ?? "").trim(),
    webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim(),
    notifySecret: (process.env.NOTIFY_SECRET ?? "").trim(),
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function db(): SupabaseClient {
  const e = env();
  return createClient(e.url, e.anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function hmacHex(secret: string, data: string) {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function razorpay<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const e = env();
  const r = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: "Basic " + Buffer.from(`${e.keyId}:${e.keySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = (await r.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!r.ok) throw new Error(json.error?.description ?? `Razorpay error ${r.status}`);
  return json;
}

export const TOKEN_RE = /^[0-9a-f-]{36}$/i;
