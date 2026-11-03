import { createClient } from "@supabase/supabase-js";
import { orderEmailHtml, subjectFor, type EmailKind, type NotifyOrder } from "@/lib/email/orderEmail";

/**
 * Sends order emails through Resend.
 *  event "placed"  → customer receipt + owner alert (once per order)
 *  event "packing" → customer "we're packing" (once, only after the shop accepts)
 * The browser only sends the order's tracking token; details come from the database,
 * which hands them out a single time and only with NOTIFY_SECRET.
 */
export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const secret = process.env.NOTIFY_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !secret || !url || !anon) return Response.json({ ok: false, reason: "not_configured" });

  let token = "";
  let event = "placed";
  try {
    const b = (await req.json()) as { token?: unknown; event?: unknown };
    token = String(b.token ?? "");
    if (b.event === "packing") event = "packing";
  } catch {
    /* fall through */
  }
  if (!/^[0-9a-f-]{36}$/i.test(token)) return Response.json({ ok: false }, { status: 400 });

  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const fn = event === "packing" ? "order_for_packing_email" : "order_for_notify";
  const { data, error } = await sb.rpc(fn, { p_token: token, p_secret: secret });
  if (error || !data) return Response.json({ ok: false, reason: "already_sent_or_unknown" });
  const o = data as NotifyOrder;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
  const from = process.env.EMAIL_FROM || `${o.store_name} <onboarding@resend.dev>`;

  const send = (kind: EmailKind, to: string, replyTo?: string | null) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: subjectFor(kind, o), html: orderEmailHtml(kind, o, siteUrl), ...(replyTo ? { reply_to: replyTo } : {}) }),
    })
      .then((r) => r.ok)
      .catch(() => false);

  const jobs: Promise<boolean>[] = [];
  if (event === "packing") {
    if (o.email) jobs.push(send("packing", o.email, o.support_email));
  } else {
    if (o.notify_email) jobs.push(send("owner", o.notify_email, o.email));
    if (o.email) jobs.push(send("received", o.email, o.support_email));
  }
  const results = await Promise.all(jobs);
  return Response.json({ ok: results.every(Boolean), sent: results.filter(Boolean).length });
}
