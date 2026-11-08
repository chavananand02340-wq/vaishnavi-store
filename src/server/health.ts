import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/config/server-env";
import { basicAuth } from "@/server/razorpay";
import { sendTestEmail } from "@/server/email/send";

/**
 * Owner-only system check (Admin → Shop settings → System check).
 * Never returns secrets: only "set / not set", short fingerprints and live results.
 */
export type Check = { ok: boolean; note: string };

export async function runHealthChecks(sb: SupabaseClient) {
  const e = serverEnv();
  const checks: Record<string, Check> = {};

  // Database
  const t0 = Date.now();
  const { error: dbErr, count } = await sb.from("products").select("id", { count: "exact", head: true });
  checks.database = { ok: !dbErr, note: dbErr ? dbErr.message : `${count ?? 0} products, ${Date.now() - t0} ms` };

  // Server secret matches the database (order emails + online payment use it)
  checks.notify_secret = await checkNotifySecret(sb, e.notifySecret);

  // Razorpay keys are accepted (read-only call, creates nothing)
  if (!e.razorpayKeyId || !e.razorpayKeySecret) checks.razorpay = { ok: false, note: "Razorpay keys are not set" };
  else {
    const r = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: basicAuth(e.razorpayKeyId, e.razorpayKeySecret) } }).catch(() => null);
    checks.razorpay = { ok: Boolean(r?.ok), note: r?.ok ? `${e.razorpayKeyId.startsWith("rzp_live_") ? "LIVE" : "TEST"} keys accepted` : `Razorpay said ${r?.status ?? "no reply"}` };
  }
  checks.razorpay_webhook = { ok: Boolean(e.razorpayWebhookSecret), note: e.razorpayWebhookSecret ? "Webhook secret set" : "RAZORPAY_WEBHOOK_SECRET not set" };

  checks.email = { ok: Boolean(e.resendApiKey && e.emailFrom), note: e.resendApiKey ? `Sender: ${e.emailFrom || "(not set)"}` : "RESEND_API_KEY not set" };

  return {
    ok: Object.values(checks).every((c) => c.ok),
    checks,
    notify_secret_fingerprint: e.notifySecret ? createHash("sha256").update(e.notifySecret).digest("hex").slice(0, 8) : null,
    site_url: e.siteUrl || null,
  };
}

async function checkNotifySecret(sb: SupabaseClient, secret: string): Promise<Check> {
  if (!secret) return { ok: false, note: "NOTIFY_SECRET is not set" };
  // Read any order (owner can), then ask the database for it with the secret: it only answers if the secret matches.
  const { data: last } = await sb.from("orders").select("public_token").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!last) return { ok: true, note: `Set (length ${secret.length}); no orders yet to test it against` };
  const { data, error } = await sb.rpc("order_for_payment", { p_token: (last as { public_token: string }).public_token, p_secret: secret });
  if (error) return { ok: false, note: `Database function missing (run SQL parts 24–25): ${error.message}` };
  return data ? { ok: true, note: "Matches the database" } : { ok: false, note: "Does NOT match the database: copy it again from Supabase" };
}

/** Sends one test email to the shop's own "Order emails" address. */
export async function testOrderEmail(sb: SupabaseClient) {
  const { data } = await sb.from("store_settings").select("notify_email, store_name").eq("id", 1).single();
  const r = data as { notify_email: string | null; store_name: string } | null;
  if (!r?.notify_email) return { ok: false, message: "Add an address in Shop settings → Order emails first." };
  return sendTestEmail(r.notify_email, r.store_name);
}
