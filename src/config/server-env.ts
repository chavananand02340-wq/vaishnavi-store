import { publicEnv } from "@/config/env";

/**
 * Server-only secrets (Cloudflare Worker secrets / .env.local).
 * Read lazily on every call so a secret changed in Cloudflare is picked up
 * without a rebuild. Importing this from browser code throws on purpose.
 */
export function serverEnv() {
  if (typeof window !== "undefined") throw new Error("serverEnv() was called in the browser");
  const read = (v: string | undefined) => (v ?? "").trim();
  return {
    ...publicEnv,
    /** Shared with the database; lets the server read an order once (emails, payments). */
    notifySecret: read(process.env.NOTIFY_SECRET),
    resendApiKey: read(process.env.RESEND_API_KEY),
    /** Sender, e.g. "Vaishnavi E-Mart <orders@vaishnavistores.shop>". Empty = Resend test sender. */
    emailFrom: read(process.env.EMAIL_FROM),
    razorpayKeyId: read(process.env.RAZORPAY_KEY_ID),
    razorpayKeySecret: read(process.env.RAZORPAY_KEY_SECRET),
    razorpayWebhookSecret: read(process.env.RAZORPAY_WEBHOOK_SECRET),
  };
}
