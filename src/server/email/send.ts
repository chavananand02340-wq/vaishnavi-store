import { serverEnv } from "@/config/server-env";
import { anonDb } from "@/server/db";
import { orderEmailHtml, subjectFor, type EmailKind, type NotifyOrder } from "@/server/email/templates";

/**
 * Order emails through Resend. Server only.
 * The database hands an order's details out a single time per event, and only
 * with NOTIFY_SECRET, so calling this twice never sends twice.
 */

export type EmailEvent = "placed" | "packing";
export type SendResult = { ok: boolean; reason?: string; sent?: number };

/** Sends one email. Never throws; returns false and logs on failure. */
async function sendEmail(msg: { to: string; subject: string; html: string; replyTo?: string | null; fromName: string }): Promise<boolean> {
  const e = serverEnv();
  const from = e.emailFrom || `${msg.fromName} <onboarding@resend.dev>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${e.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, ...(msg.replyTo ? { reply_to: msg.replyTo } : {}) }),
    });
    if (!r.ok) console.error("[email] Resend error", r.status, await r.text().catch(() => ""));
    return r.ok;
  } catch (err) {
    console.error("[email] Resend fetch failed", err);
    return false;
  }
}

/**
 *  "placed"  → customer receipt + owner alert
 *  "packing" → customer "we're packing your order"
 */
export async function sendOrderEmails(token: string, event: EmailEvent, origin: string): Promise<SendResult> {
  const e = serverEnv();
  if (!e.resendApiKey || !e.notifySecret || !e.supabaseUrl || !e.supabaseAnonKey) return { ok: false, reason: "not_configured" };

  const fn = event === "packing" ? "order_for_packing_email" : "order_for_notify";
  const { data, error } = await anonDb().rpc(fn, { p_token: token, p_secret: e.notifySecret });
  if (error || !data) return { ok: false, reason: "already_sent_or_unknown" };
  const o = data as NotifyOrder;
  const siteUrl = (e.siteUrl || origin).replace(/\/$/, "");

  const send = (kind: EmailKind, to: string, replyTo?: string | null) =>
    sendEmail({ to, subject: subjectFor(kind, o), html: orderEmailHtml(kind, o, siteUrl), replyTo, fromName: o.store_name });

  const jobs: Promise<boolean>[] = [];
  if (event === "packing") {
    if (o.email) jobs.push(send("packing", o.email, o.support_email));
  } else {
    if (o.notify_email) jobs.push(send("owner", o.notify_email, o.email));
    if (o.email) jobs.push(send("received", o.email, o.support_email));
  }
  const results = await Promise.all(jobs);
  return { ok: results.every(Boolean), sent: results.filter(Boolean).length };
}

/** Owner's "send test email" button. Returns what Resend said. */
export async function sendTestEmail(to: string, storeName: string): Promise<{ ok: boolean; message: string }> {
  const e = serverEnv();
  if (!e.resendApiKey) return { ok: false, message: "RESEND_API_KEY is not set." };
  const from = e.emailFrom || `${storeName} <onboarding@resend.dev>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: "Test email from your website", html: "<p>If you can read this, order emails work. 🎉</p>" }),
  }).catch(() => null);
  if (!res) return { ok: false, message: "Couldn't reach Resend." };
  const body = await res.text();
  return { ok: res.ok, message: res.ok ? `Test email sent to ${to}` : `Resend said ${res.status}: ${body.slice(0, 200)}` };
}
