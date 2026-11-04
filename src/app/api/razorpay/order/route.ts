import { db, env, razorpay, TOKEN_RE } from "@/lib/razorpay-server";

type PayInfo = {
  order_no: number; total_paise: number; status: string; payment_method: string; payment_status: string;
  razorpay_order_id: string | null; customer_name: string; phone: string; email: string | null; store_name: string;
};

/** Creates a Razorpay order for one of our orders. The amount always comes from the database. */
export async function POST(req: Request) {
  const e = env();
  if (!e.keyId || !e.keySecret || !e.notifySecret) return Response.json({ ok: false, message: "Online payment is not set up yet." }, { status: 503 });
  const { token } = ((await req.json().catch(() => ({}))) ?? {}) as { token?: string };
  if (!token || !TOKEN_RE.test(token)) return Response.json({ ok: false, message: "Bad request" }, { status: 400 });

  const sb = db();
  const { data, error } = await sb.rpc("order_for_payment", { p_token: token, p_secret: e.notifySecret });
  const o = data as PayInfo | null;
  if (error) return Response.json({ ok: false, message: "Online payment setup isn't finished (SQL part 25)." }, { status: 503 });
  if (!o) {
    // Order exists but the secret didn't match → setup problem, not the customer's fault.
    const { data: exists } = await sb.rpc("get_order_by_token", { p_token: token });
    return Response.json(
      { ok: false, message: exists ? "Payment setup issue: NOTIFY_SECRET in Netlify doesn't match Supabase. Please tell the shop." : "Order not found." },
      { status: exists ? 503 : 404 },
    );
  }
  if (o.payment_method !== "online") return Response.json({ ok: false, message: "This order is not an online payment order." }, { status: 400 });
  if (o.payment_status === "paid") return Response.json({ ok: false, paid: true, message: "Already paid." });
  if (o.status === "cancelled") return Response.json({ ok: false, message: "This order was cancelled." }, { status: 400 });

  try {
    // Re-use the Razorpay order if the amount is still the same, otherwise make a fresh one.
    let rpId = o.razorpay_order_id;
    if (rpId) {
      const existing = await razorpay<{ amount: number; status: string }>(`/orders/${rpId}`).catch(() => null);
      if (!existing || existing.amount !== o.total_paise || existing.status === "paid") rpId = null;
    }
    if (!rpId) {
      const created = await razorpay<{ id: string }>("/orders", {
        method: "POST",
        body: { amount: o.total_paise, currency: "INR", receipt: `VS-${o.order_no}`, notes: { order_no: String(o.order_no), token } },
      });
      rpId = created.id;
      await sb.rpc("set_razorpay_order", { p_token: token, p_secret: e.notifySecret, p_rp_order: rpId });
    }
    return Response.json({
      ok: true,
      key: e.keyId,
      order_id: rpId,
      amount: o.total_paise,
      name: o.store_name,
      description: `Order VS-${o.order_no}`,
      prefill: { name: o.customer_name, contact: `+91${o.phone}`, email: o.email ?? undefined },
    });
  } catch (err) {
    return Response.json({ ok: false, message: err instanceof Error ? err.message : "Couldn't start payment." }, { status: 502 });
  }
}
