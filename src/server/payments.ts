import { serverEnv } from "@/config/server-env";
import { AppError } from "@/lib/errors";
import { orderLabel } from "@/config/site";
import { anonDb } from "@/server/db";
import { hmacHex, razorpay, safeEqual } from "@/server/razorpay";
import { sendOrderEmails } from "@/server/email/send";

/**
 * Online payment (Razorpay). The amount always comes from the database, never the browser.
 * Flow: createPayment → customer pays in Razorpay → verifyPayment (browser) and/or
 * handleWebhook (Razorpay server) → mark_online_paid → "order received" emails.
 */

type PayInfo = {
  order_no: number;
  total_paise: number;
  status: string;
  payment_method: string;
  payment_status: string;
  razorpay_order_id: string | null;
  customer_name: string;
  phone: string;
  email: string | null;
  store_name: string;
};

export type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  name: string;
  description: string;
  prefill: { name: string; contact: string; email?: string };
};

/** Already paid: not an error for the customer, but nothing to start. */
export class AlreadyPaid extends Error {}

/** Creates (or re-uses) the Razorpay order for one of our orders. */
export async function createPayment(token: string): Promise<CheckoutOptions> {
  const e = serverEnv();
  if (!e.razorpayKeyId || !e.razorpayKeySecret || !e.notifySecret) throw new AppError("not_configured", "Online payment is not set up yet.");

  const sb = anonDb();
  const { data, error } = await sb.rpc("order_for_payment", { p_token: token, p_secret: e.notifySecret });
  if (error) throw new AppError("not_configured", "Online payment setup isn't finished (SQL part 25).", { cause: error });
  const o = data as PayInfo | null;
  if (!o) {
    // Order exists but the secret didn't match → setup problem, not the customer's fault.
    const { data: exists } = await sb.rpc("get_order_by_token", { p_token: token });
    if (exists) throw new AppError("not_configured", "Payment setup issue: NOTIFY_SECRET in Cloudflare doesn't match Supabase. Please tell the shop.");
    throw new AppError("not_found", "Order not found.");
  }
  if (o.payment_method !== "online") throw new AppError("invalid", "This order is not an online payment order.");
  if (o.payment_status === "paid") throw new AlreadyPaid("Already paid.");
  if (o.status === "cancelled") throw new AppError("invalid", "This order was cancelled.");

  // Re-use the Razorpay order if the amount is unchanged, otherwise make a fresh one.
  let rpId = o.razorpay_order_id;
  if (rpId) {
    const existing = await razorpay<{ amount: number; status: string }>(`/orders/${rpId}`).catch(() => null);
    if (!existing || existing.amount !== o.total_paise || existing.status === "paid") rpId = null;
  }
  if (!rpId) {
    const created = await razorpay<{ id: string }>("/orders", {
      method: "POST",
      body: { amount: o.total_paise, currency: "INR", receipt: orderLabel(o.order_no), notes: { order_no: String(o.order_no), token } },
    });
    rpId = created.id;
    await sb.rpc("set_razorpay_order", { p_token: token, p_secret: e.notifySecret, p_rp_order: rpId });
  }
  return {
    key: e.razorpayKeyId,
    order_id: rpId,
    amount: o.total_paise,
    name: o.store_name,
    description: `Order ${orderLabel(o.order_no)}`,
    prefill: { name: o.customer_name, contact: `+91${o.phone}`, email: o.email ?? undefined },
  };
}

type MarkPaid = { ok: boolean; code?: string; already?: boolean; public_token?: string } | null;

/** Records the payment once; sends the "order received" emails the first time. */
async function markPaid(rpOrderId: string, rpPaymentId: string | null, amountPaise: number, origin: string): Promise<MarkPaid> {
  const e = serverEnv();
  const { data } = await anonDb().rpc("mark_online_paid", { p_secret: e.notifySecret, p_rp_order: rpOrderId, p_rp_payment: rpPaymentId, p_amount_paise: amountPaise });
  const r = data as MarkPaid;
  if (r?.ok && !r.already && r.public_token) await sendOrderEmails(r.public_token, "placed", origin);
  return r;
}

/** Customer's browser after Razorpay says "paid": check the signature, then mark paid. */
export async function verifyPayment(b: { razorpay_order_id?: unknown; razorpay_payment_id?: unknown; razorpay_signature?: unknown }, origin: string) {
  const e = serverEnv();
  if (!e.razorpayKeySecret || !e.notifySecret) throw new AppError("not_configured", "Online payment is not set up yet.");
  const orderId = String(b.razorpay_order_id ?? "");
  const paymentId = String(b.razorpay_payment_id ?? "");
  const sig = String(b.razorpay_signature ?? "");
  if (!orderId || !paymentId || !sig) throw new AppError("invalid", "Missing payment details.");
  if (!safeEqual(hmacHex(e.razorpayKeySecret, `${orderId}|${paymentId}`), sig)) throw new AppError("invalid", "Payment could not be verified.");

  // Amount actually paid, straight from Razorpay.
  const rp = await razorpay<{ amount_paid: number }>(`/orders/${orderId}`).catch(() => null);
  if (!rp) throw new AppError("upstream", "Couldn't confirm with Razorpay. The shop will check.");
  const r = await markPaid(orderId, paymentId, rp.amount_paid, origin);
  if (!r?.ok) throw new AppError(r?.code === "amount_mismatch" ? "conflict" : "unknown", r?.code === "amount_mismatch" ? "Amount didn't match. The shop will check." : "Couldn't save payment. The shop will check.", { status: 200 });
}

type WebhookEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } };
    order?: { entity?: { id?: string; amount_paid?: number } };
  };
};

/**
 * Razorpay → our server, even if the customer closed the page after paying.
 * Razorpay Dashboard → Webhooks, events "payment.captured" and "order.paid".
 */
export async function handleWebhook(raw: string, signature: string, origin: string) {
  const e = serverEnv();
  if (!e.razorpayWebhookSecret || !signature || !safeEqual(hmacHex(e.razorpayWebhookSecret, raw), signature)) {
    throw new AppError("invalid", "Bad signature.");
  }
  let evt: WebhookEvent;
  try {
    evt = JSON.parse(raw) as WebhookEvent;
  } catch {
    throw new AppError("invalid", "Bad JSON.");
  }
  const pay = evt.payload?.payment?.entity;
  const ord = evt.payload?.order?.entity;
  const rpOrderId = ord?.id ?? pay?.order_id;
  if ((evt.event === "payment.captured" || evt.event === "order.paid") && rpOrderId) {
    await markPaid(rpOrderId, pay?.id ?? null, ord?.amount_paid ?? pay?.amount ?? 0, origin);
  }
}
