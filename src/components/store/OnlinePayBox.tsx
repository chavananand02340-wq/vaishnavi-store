"use client";

import { useEffect, useRef, useState } from "react";
import { confirmPayment, loadRazorpay, startPayment, type RzpResponse } from "@/services/payments";
import { formatPaise } from "@/lib/money";
import { THEME_COLOR } from "@/config/site";
import { Icon } from "@/components/ui/Icon";

/** Online payment (Razorpay) on the order page, including the "Payment failed" screen. */
export function OnlinePayBox({ token, total, paid, autoOpen, onPaid }: { token: string; total: number; paid: boolean; autoOpen: boolean; onPaid: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const started = useRef(false);

  async function pay() {
    setBusy(true);
    setMsg(null);
    setFailed(null);
    const ok = await loadRazorpay();
    if (!ok || !window.Razorpay) {
      setBusy(false);
      return setMsg({ ok: false, text: "Couldn't load the payment page. Check your internet and try again." });
    }
    const r = await startPayment(token);
    if (!r.ok) {
      setBusy(false);
      if (r.paid) return onPaid();
      return setMsg({ ok: false, text: r.message });
    }
    const o = r.options;
    const rzp = new window.Razorpay({
      key: o.key,
      order_id: o.order_id,
      amount: o.amount,
      currency: "INR",
      name: o.name,
      description: o.description,
      image: `${window.location.origin}/icons/icon-192.png`,
      prefill: o.prefill,
      theme: { color: THEME_COLOR },
      retry: { enabled: false },
      modal: { ondismiss: () => setBusy(false) },
      handler: async (resp: RzpResponse) => {
        setMsg({ ok: true, text: "Payment received. Confirming…" });
        const v = await confirmPayment(resp);
        setBusy(false);
        setMsg(v.ok ? { ok: true, text: "Paid! Thank you. The shop is preparing your order." } : { ok: false, text: v.message ?? "We got your payment but couldn't confirm it yet. The shop will check it." });
        onPaid();
      },
    });
    rzp.on("payment.failed", (e) => {
      setBusy(false);
      setFailed(e.error?.description ?? "The payment didn't go through.");
      try {
        rzp.close?.();
      } catch {
        /* already closed */
      }
    });
    rzp.open();
  }

  useEffect(() => {
    if (autoOpen && !paid && !started.current) {
      started.current = true;
      void pay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, paid]);

  if (paid) {
    return (
      <section className="flex items-center gap-3 rounded-[var(--radius-card)] bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200">
        <Icon name="check" className="size-6 shrink-0" strokeWidth={3} />
        <p className="text-[15px] font-bold">Paid online, {formatPaise(total)}. Thank you!</p>
      </section>
    );
  }
  if (failed) {
    return (
      <section className="rounded-[var(--radius-card)] bg-white p-5 text-center ring-2 ring-rose-300" role="alert">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <Icon name="x" className="size-8" strokeWidth={3} />
        </span>
        <h2 className="mt-3 font-display text-[22px] font-extrabold text-rose-800">Payment failed</h2>
        <p className="mt-1 text-[15px] text-ink">{failed}</p>
        <p className="mt-2 text-[14px] text-muted">
          Don&apos;t worry: no money was taken. If money was deducted, it is refunded to your account automatically in 5–7 days.
        </p>
        <button type="button" onClick={pay} disabled={busy} className="btn-haldi mt-4 w-full text-[17px]">
          {busy ? "Opening payment…" : `Try again, ${formatPaise(total)}`}
        </button>
        <p className="mt-3 text-[13px] text-muted">Try another UPI app, card or bank. Still stuck? Call or WhatsApp the shop below.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-card)] bg-white p-4 text-center ring-1 ring-line">
      <h2 className="text-[17px] font-bold">Pay {formatPaise(total)} online</h2>
      <p className="mt-1 text-[14px] text-muted">UPI (GPay, PhonePe, Paytm), cards or netbanking.</p>
      <button type="button" onClick={pay} disabled={busy} className="btn-haldi mt-3 w-full text-[17px]">
        {busy ? "Opening payment…" : `Pay ${formatPaise(total)} now`}
      </button>
      {msg && <p className={`mt-2 text-[14px] font-semibold ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}
      <p className="mt-2 text-[12px] text-muted">Secure payment by Razorpay</p>
    </section>
  );
}
