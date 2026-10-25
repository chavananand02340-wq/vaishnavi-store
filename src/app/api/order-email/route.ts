import { createClient } from "@supabase/supabase-js";
import { orderEmailHtml, rupees, type NotifyOrder } from "@/lib/email/orderEmail";

/**
 * Sends the "new order" emails through Resend, once per order.
 * The browser only sends the order's tracking token; the order details come from
 * the database, which hands them out a single time and only with NOTIFY_SECRET.
 */
export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const secret = process.env.NOTIFY_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !secret || !url || !anon) return Response.json({ ok: false, reason: "not_configured" });

  let token = "";
  try {
    token = String(((await req.json()) as { token?: unknown }).token ?? "");
  } catch {
    /* fall through */
  }
  if (!/^[0-9a-f-]{36}$/i.test(token)) return Response.json({ ok: false }, { status: 400 });

  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("order_for_notify", { p_token: token, p_secret: secret });
  if (error || !data) return Response.json({ ok: false, reason: "already_sent_or_unknown" });
  const o = data as NotifyOrder;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
  const from = process.env.EMAIL_FROM || `${o.store_name} <onboarding@resend.dev>`;

  const send = (to: string, subject: string, html: string, replyTo?: string | null) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    })
      .then((r) => r.ok)
      .catch(() => false);

  const jobs: Promise<boolean>[] = [];
  if (o.notify_email) {
    jobs.push(send(o.notify_email, `New order #${o.order_no}: ${rupees(o.total_paise)} (${o.payment_method === "cod" ? "Cash" : "UPI"})`, orderEmailHtml(o, { forOwner: true, siteUrl }), o.email));
  }
  if (o.email) {
    jobs.push(send(o.email, `Your ${o.store_name} order #${o.order_no}`, orderEmailHtml(o, { forOwner: false, siteUrl }), o.support_email));
  }
  const results = await Promise.all(jobs);
  return Response.json({ ok: results.every(Boolean), sent: results.filter(Boolean).length });
}
