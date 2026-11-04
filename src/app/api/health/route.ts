import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

/** Setup check. Shows only whether keys are set, plus a short fingerprint of NOTIFY_SECRET (not the secret). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("email") === "1") return testEmail();
  const s = (process.env.NOTIFY_SECRET ?? "").trim();
  return Response.json({
    notify_secret_set: Boolean(s),
    notify_secret_length: s.length,
    notify_secret_fingerprint: s ? createHash("sha256").update(s).digest("hex").slice(0, 8) : null,
    razorpay_key_id: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.trim().slice(0, 9) + "…" : null,
    razorpay_key_secret_set: Boolean(process.env.RAZORPAY_KEY_SECRET),
    razorpay_webhook_secret_set: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    resend_key_set: Boolean(process.env.RESEND_API_KEY),
    email_from: process.env.EMAIL_FROM ?? null,
    site_url: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  });
}

/** Sends one test email to the shop's own "Order emails" address and reports exactly what Resend said. */
async function testEmail() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return Response.json({ ok: false, problem: "RESEND_API_KEY is not set in Netlify (or no deploy after adding it)." });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const r = await fetch(`${url}/rest/v1/store_settings?id=eq.1&select=notify_email,store_name`, { headers: { apikey: anon ?? "", Authorization: `Bearer ${anon}` } });
  const row = ((await r.json().catch(() => [])) as { notify_email: string | null; store_name: string }[])[0];
  if (!row?.notify_email) return Response.json({ ok: false, problem: "No 'Order emails' address in Admin → Shop settings." });
  const from = process.env.EMAIL_FROM?.trim() || `${row.store_name} <onboarding@resend.dev>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [row.notify_email], subject: "Test email from your website", html: "<p>If you can read this, order emails work. 🎉</p>" }),
  });
  const body = await res.text();
  return Response.json({ ok: res.ok, sent_to: row.notify_email.replace(/^(.).*(@.*)$/, "$1***$2"), from, resend_status: res.status, resend_said: body.slice(0, 300) });
}
