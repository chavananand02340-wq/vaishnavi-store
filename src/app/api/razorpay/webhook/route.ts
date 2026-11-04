import { sendOrderEmails } from "@/lib/email/send";
import { db, env, hmacHex, safeEqual } from "@/lib/razorpay-server";

/**
 * Razorpay → our server, even if the customer closed the page after paying.
 * Set it up in Razorpay Dashboard → Webhooks with the events "payment.captured" and "order.paid".
 */
export async function POST(req: Request) {
  const e = env();
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!e.webhookSecret || !sig || !safeEqual(hmacHex(e.webhookSecret, raw), sig)) {
    return Response.json({ ok: false }, { status: 400 });
  }
  type Evt = { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } }; order?: { entity?: { id?: string; amount_paid?: number } } } };
  let evt: Evt = {};
  try {
    evt = JSON.parse(raw) as Evt;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const pay = evt.payload?.payment?.entity;
  const ord = evt.payload?.order?.entity;
  if ((evt.event === "payment.captured" || evt.event === "order.paid") && (pay?.order_id || ord?.id)) {
    const orderId = ord?.id ?? pay!.order_id!;
    const amount = ord?.amount_paid ?? pay?.amount ?? 0;
    const { data } = await db().rpc("mark_online_paid", { p_secret: e.notifySecret, p_rp_order: orderId, p_rp_payment: pay?.id ?? null, p_amount_paise: amount });
    const r = data as { ok: boolean; already?: boolean; public_token?: string } | null;
    if (r?.ok && !r.already && r.public_token) await sendOrderEmails(r.public_token, "placed", new URL(req.url).origin);
  }
  // Always 200 for a valid signature so Razorpay doesn't keep retrying events we don't use.
  return Response.json({ ok: true });
}
