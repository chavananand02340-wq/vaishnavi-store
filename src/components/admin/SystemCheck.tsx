"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { Card, CardTitle } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";

type Result = { ok: boolean; checks?: Record<string, { ok: boolean; note: string }>; message?: string };

const LABELS: Record<string, string> = {
  database: "Database (Supabase)",
  notify_secret: "Server secret",
  razorpay: "Online payment (Razorpay)",
  razorpay_webhook: "Razorpay webhook",
  email: "Order emails (Resend)",
};

/** Owner-only: checks every connection the website needs, and can send a test email. */
export function SystemCheck() {
  const [res, setRes] = useState<Result | null>(null);
  const [mail, setMail] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "check" | "mail">("");

  async function call(q: string) {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token ?? "";
    const r = await fetch(`/api/health${q}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    return (await r.json().catch(() => ({ ok: false, message: "No reply from the website." }))) as Result;
  }

  return (
    <Card>
      <CardTitle hint="Checks the database, payments and emails are connected. Nothing is charged or changed.">System check</CardTitle>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy !== ""}
          onClick={async () => {
            setBusy("check");
            setRes(await call(""));
            setBusy("");
          }}
          className="btn flex-1 bg-slate-800 text-white"
        >
          {busy === "check" ? "Checking…" : "Run check"}
        </button>
        <button
          type="button"
          disabled={busy !== ""}
          onClick={async () => {
            setBusy("mail");
            const r = await call("?email=1");
            setMail(r.message ?? (r.ok ? "Sent" : "Failed"));
            setBusy("");
          }}
          className="btn-plain flex-1"
        >
          {busy === "mail" ? "Sending…" : "Send test email"}
        </button>
      </div>
      {mail && <p className="mt-2 text-[14px] font-semibold text-slate-700">{mail}</p>}
      {res && (
        <ul className="mt-3 space-y-1.5">
          {res.checks ? (
            Object.entries(res.checks).map(([k, c]) => (
              <li key={k} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[14px] ${c.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
                <Icon name={c.ok ? "check" : "alert"} className="mt-0.5 size-4 shrink-0" strokeWidth={2.6} />
                <span>
                  <b>{LABELS[k] ?? k}</b>: {c.note}
                </span>
              </li>
            ))
          ) : (
            <li className="rounded-xl bg-rose-50 px-3 py-2 text-[14px] text-rose-900">{res.message}</li>
          )}
        </ul>
      )}
    </Card>
  );
}
