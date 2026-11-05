import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Owner-only system check (used by Admin → Shop settings → System check).
 * Never returns secrets: only "set / not set", short fingerprints and the result of live checks.
 */
export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !url || !anon) return Response.json({ ok: false, message: "Owner login required." }, { status: 401 });
  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isOwner } = await sb.rpc("is_owner");
  if (isOwner !== true) return Response.json({ ok: false, message: "Owner login required." }, { status: 403 });

  const u = new URL(req.url);
  if (u.searchParams.get("email") === "1") return testEmail(sb);

  const s = (process.env.NOTIFY_SECRET ?? "").trim();
  const keyId = (process.env.RAZORPAY_KEY_ID ?? "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").trim();

  const checks: Record<string, { ok: boolean; note: string }> = {};

  // Database
  const t0 = Date.now();
  const { error: dbErr, count } = await sb.from("products").select("id", { count: "exact", head: true });
  checks.database = { ok: !dbErr, note: dbErr ? dbErr.message : `${count ?? 0} products, ${Date.now() - t0} ms` };

  // Server secret matches the database (order emails + online payment use it)
  if (!s) checks.notify_secret = { ok: false, note: "NOTIFY_SECRET is not set" };
  else {
    // Read any order (owner can), then ask the database for it using the secret: it only answers if the secret matches.
    const { data: last } = await sb.from("orders").select("public_token").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last) checks.notify_secret = { ok: true, note: `Set (length ${s.length}); no orders yet to test it against` };
    else {
      const { data, error } = await sb.rpc("order_for_payment", { p_token: (last as { public_token: string }).public_token, p_secret: s });
      checks.notify_secret = {
        ok: !error && data !== null,
        note: error ? `Database function missing (run SQL parts 24–25): ${error.message}` : data ? "Matches the database" : "Does NOT match the database: copy it again from Supabase",
      };
    }
  }

  // Razorpay keys are accepted by Razorpay (read-only call, creates nothing)
  if (!keyId || !keySecret) checks.razorpay = { ok: false, note: "Razorpay keys are not set" };
  else {
    const r = await fetch("https://api.razorpay.com/v1/orders?count=1", {
      headers: { Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64") },
    }).catch(() => null);
    checks.razorpay = { ok: Boolean(r?.ok), note: r?.ok ? `${keyId.startsWith("rzp_live_") ? "LIVE" : "TEST"} keys accepted` : `Razorpay said ${r?.status ?? "no reply"}` };
  }
  checks.razorpay_webhook = { ok: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET), note: process.env.RAZORPAY_WEBHOOK_SECRET ? "Webhook secret set" : "RAZORPAY_WEBHOOK_SECRET not set" };

  // Email
  checks.email = {
    ok: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    note: process.env.RESEND_API_KEY ? `Sender: ${process.env.EMAIL_FROM ?? "(not set)"}` : "RESEND_API_KEY not set",
  };

  return Response.json({
    ok: Object.values(checks).every((c) => c.ok),
    checks,
    notify_secret_fingerprint: s ? createHash("sha256").update(s).digest("hex").slice(0, 8) : null,
    site_url: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  });
}

/** Sends one test email to the shop's own "Order emails" address and reports what Resend said. */
async function testEmail(sb: ReturnType<typeof createClient>) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return Response.json({ ok: false, message: "RESEND_API_KEY is not set." });
  const { data: row } = await sb.from("store_settings").select("notify_email, store_name").eq("id", 1).single();
  const r = row as { notify_email: string | null; store_name: string } | null;
  if (!r?.notify_email) return Response.json({ ok: false, message: "Add an address in Shop settings → Order emails first." });
  const from = process.env.EMAIL_FROM?.trim() || `${r.store_name} <onboarding@resend.dev>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [r.notify_email], subject: "Test email from your website", html: "<p>If you can read this, order emails work. 🎉</p>" }),
  });
  const body = await res.text();
  return Response.json({ ok: res.ok, message: res.ok ? `Test email sent to ${r.notify_email}` : `Resend said ${res.status}: ${body.slice(0, 200)}` });
}
