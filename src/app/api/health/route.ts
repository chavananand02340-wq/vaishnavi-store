import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

/** Setup check. Shows only whether keys are set, plus a short fingerprint of NOTIFY_SECRET (not the secret). */
export async function GET() {
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
