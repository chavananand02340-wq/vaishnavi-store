import { sendOrderEmails } from "@/lib/email/send";
import { db, env, hmacHex, razorpay, safeEqual } from "@/lib/razorpay-server";

/** Called by the customer's browser after Razorpay says "paid". We check the signature, then mark paid. */
export async function POST(req: Request) {
  const e = env();
  if (!e.keySecret || !e.notifySecret) return Response.json({ ok: false }, { status: 503 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  const orderId = String(b.razorpay_order_id ?? "");
  const paymentId = String(b.razorpay_payment_id ?? "");
  const sig = String(b.razorpay_signature ?? "");
  if (!orderId || !paymentId || !sig) return Response.json({ ok: false, message: "Missing payment details." }, { status: 400 });

  if (!safeEqual(hmacHex(e.keySecret, `${orderId}|${paymentId}`), sig)) {
    return Response.json({ ok: false, message: "Payment could not be verified." }, { status: 400 });
  }
  // Amount actually paid, straight from Razorpay.
  const rp = await razorpay<{ amount_paid: number }>(`/orders/${orderId}`).catch(() => null);
  if (!rp) return Response.json({ ok: false, message: "Couldn't confirm with Razorpay. The shop will check." }, { status: 502 });
  const { data } = await db().rpc("mark_online_paid", { p_secret: e.notifySecret, p_rp_order: orderId, p_rp_payment: paymentId, p_amount_paise: rp.amount_paid });
  const r = data as { ok: boolean; code?: string; already?: boolean; public_token?: string } | null;
  if (r?.ok && !r.already && r.public_token) await sendOrderEmails(r.public_token, "placed", new URL(req.url).origin);
  return Response.json(r?.ok ? { ok: true } : { ok: false, message: r?.code === "amount_mismatch" ? "Amount didn't match. The shop will check." : "Couldn't save payment. The shop will check." });
}
