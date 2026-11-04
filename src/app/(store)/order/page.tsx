"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase/browser";
import { formatPaise } from "@/lib/money";
import { istTime } from "@/lib/hours";
import { waLink } from "@/lib/cards";
import { useAsync } from "@/lib/useAsync";
import { useCart } from "@/components/store/cart";
import { PageBar } from "@/components/store/PageBar";
import { Icon } from "@/components/Icon";
import { WaIcon } from "@/components/WaIcon";

type OrderView = {
  order_no: number;
  status: "new" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled";
  created_at: string;
  confirmed_at: string | null;
  eta_minutes: number | null;
  payment_method: "cod" | "upi" | "online";
  payment_status: "unpaid" | "awaiting_verification" | "paid";
  subtotal_paise: number;
  delivery_fee_paise: number;
  discount_paise?: number;
  coupon_code?: string | null;
  total_paise: number;
  customer_first_name: string;
  items: { product_name: string; variant_label: string; qty: number; line_total_paise: number; is_unavailable: boolean }[];
};

const STEPS = [
  { key: "new", title: "Order received", text: "The shop has your order." },
  { key: "confirmed", title: "Packing", text: "Your items are being packed." },
  { key: "out_for_delivery", title: "On the way", text: "Your order has left the shop." },
  { key: "delivered", title: "Delivered", text: "Enjoy! Thank you for shopping with us." },
] as const;

function OrderInner() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const isNew = params.get("new") === "1";
  const { settings: s } = useCart();
  const valid = /^[0-9a-f-]{36}$/i.test(token);

  const { data: o, loading, reload } = useAsync(async () => {
    if (!valid) return null;
    const { data } = await supabase().rpc("get_order_by_token", { p_token: token });
    return (data as OrderView | null) ?? null;
  }, [token]);

  // Keep the status fresh while the order is moving.
  useEffect(() => {
    if (!o || o.status === "delivered" || o.status === "cancelled") return;
    const t = setInterval(() => document.visibilityState === "visible" && reload(), 30_000);
    return () => clearInterval(t);
  }, [o, reload]);

  if (loading) return <p className="py-16 text-center text-muted">Loading your order…</p>;
  if (!o) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="font-display text-[22px] font-bold">Order not found</p>
        <p className="mt-1 text-muted">Check the link, or call the shop with your order number.</p>
        <Link href="/" className="btn-brand mt-6 px-8">Go to shop</Link>
      </div>
    );
  }

  const no = `VS-${o.order_no}`;
  const step = STEPS.findIndex((x) => x.key === o.status);
  const awaitingPay = o.payment_method === "online" && o.payment_status !== "paid" && o.status !== "cancelled";
  const moving = !awaitingPay && o.status !== "delivered" && o.status !== "cancelled";
  const live = o.items.filter((i) => !i.is_unavailable);
  const wa = waLink(s?.whatsapp_number, `Hello, about my order ${no} (${formatPaise(o.total_paise)}):\n${live.map((i) => `${i.qty} x ${i.product_name} (${i.variant_label})`).join("\n")}`);

  return (
    <main className="mx-auto max-w-3xl space-y-3 px-3 pb-16 pt-3">
      <section className={`overflow-hidden rounded-[var(--radius-card)] text-white ${o.status === "cancelled" ? "bg-neutral-700" : awaitingPay ? "bg-ink" : "bg-brand-700"}`}>
        <div className="p-5">
          {awaitingPay ? (
            <p className="text-[15px] font-semibold text-haldi-300">One last step, {o.customer_first_name}</p>
          ) : (
            isNew && o.status === "new" && <p className="text-[15px] font-semibold text-haldi-300">Thank you, {o.customer_first_name}!</p>
          )}
          <p className="font-display text-[30px] font-extrabold leading-tight">
            {o.status === "cancelled" ? "Order cancelled" : awaitingPay ? "Payment pending" : step >= 0 ? STEPS[step].title : "Order placed"}
          </p>
          {awaitingPay && <p className="mt-1 text-[15px] text-white/85">Pay {formatPaise(o.total_paise)} to confirm your order. The shop starts packing once it&apos;s paid.</p>}
          <p className="mt-1 text-[15px] text-white/80">
            Order {no}, placed at {istTime(o.created_at)}
          </p>
        </div>
        {moving && o.eta_minutes ? (
          <div className="flex items-center gap-3 bg-haldi-500 px-5 py-3 text-brand-900">
            <Icon name="clock" className="size-5" strokeWidth={2.4} />
            <p className="text-[15px] font-bold">
              Arrives in about {o.eta_minutes} min{o.confirmed_at ? ` from ${istTime(o.confirmed_at)}` : " after the shop confirms"}
            </p>
          </div>
        ) : null}
      </section>

      {o.payment_method === "online" && o.status !== "cancelled" && (
        <OnlinePayBox token={token} total={o.total_paise} paid={o.payment_status === "paid"} autoOpen={params.get("pay") === "1"} onPaid={reload} />
      )}


      {o.status !== "cancelled" && !awaitingPay && (
        <ol className="rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
          {STEPS.map((st, i) => {
            const done = i <= step;
            return (
              <li key={st.key} className="relative flex gap-3 pb-4 last:pb-0">
                {i < STEPS.length - 1 && <span className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${i < step ? "bg-brand-600" : "bg-line"}`} aria-hidden />}
                <span className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ${done ? "bg-brand-700 text-white" : "border-2 border-line bg-white"}`}>
                  {done && <Icon name="check" className="size-4" strokeWidth={3} />}
                </span>
                <span>
                  <span className={`block text-[16px] ${done ? "font-bold" : "font-semibold text-muted"}`}>{st.title}</span>
                  {i === step && <span className="text-[14px] text-muted">{st.text}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {o.payment_method === "upi" && o.payment_status !== "paid" && o.status !== "cancelled" && (
        <UpiBox token={token} total={o.total_paise} orderNo={no} waiting={o.payment_status === "awaiting_verification"} onSent={reload} />
      )}

      <section className="rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
        <h2 className="mb-2 text-[17px] font-bold">Items</h2>
        <ul className="space-y-1.5 text-[15px]">
          {o.items.map((i, idx) => (
            <li key={idx} className={`flex justify-between gap-3 ${i.is_unavailable ? "text-muted line-through" : ""}`}>
              <span className="min-w-0">{i.qty} × {i.product_name} <span className="text-muted">({i.variant_label})</span></span>
              <span className="shrink-0 font-semibold">{formatPaise(i.line_total_paise)}</span>
            </li>
          ))}
        </ul>
        {o.items.some((i) => i.is_unavailable) && <p className="mt-2 text-[14px] text-haldi-700">Crossed-out items weren't available today. They're removed from your bill.</p>}
        <dl className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3 text-[15px]">
          <div className="flex justify-between"><dt className="text-muted">Items</dt><dd>{formatPaise(o.subtotal_paise)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{o.delivery_fee_paise === 0 ? "Free" : formatPaise(o.delivery_fee_paise)}</dd></div>
          {(o.discount_paise ?? 0) > 0 && (
            <div className="flex justify-between font-semibold text-emerald-700"><dt>Coupon {o.coupon_code}</dt><dd>−{formatPaise(o.discount_paise ?? 0)}</dd></div>
          )}
          <div className="flex justify-between text-[18px] font-extrabold"><dt>Total</dt><dd>{formatPaise(o.total_paise)}</dd></div>
          <div className="flex justify-between text-muted">
            <dt>Payment</dt>
            <dd>
              {o.payment_method === "cod" ? "Cash on delivery" : o.payment_method === "online" ? "Online" : "UPI"},{" "}
              {o.payment_status === "paid" ? "paid" : o.payment_status === "awaiting_verification" ? "being checked" : o.payment_method === "online" ? "not paid yet" : "pay on delivery"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid grid-cols-2 gap-2">
        {wa && (
          <a href={wa} rel="noopener" className="btn bg-[#25d366] text-[#073b20]">
            <WaIcon /> WhatsApp shop
          </a>
        )}
        {s?.phone_primary && (
          <a href={`tel:+91${s.phone_primary}`} className="btn-plain">
            <Icon name="phone" /> Call shop
          </a>
        )}
      </section>
      <p className="px-2 text-center text-[14px] text-muted">Bookmark this page to check your order. It updates on its own.</p>
      <Link href="/" className="block py-2 text-center text-[15px] font-bold text-brand-700">Continue shopping</Link>
    </main>
  );
}

function UpiBox({ token, total, orderNo, waiting, onSent }: { token: string; total: number; orderNo: string; waiting: boolean; onSent: () => void }) {
  const { settings } = useCart();
  const [qr, setQr] = useState<string | null>(null);
  const [vpa, setVpa] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [utr, setUtr] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().from("store_settings").select("upi_id, upi_payee_name").eq("id", 1).maybeSingle();
      if (!data?.upi_id) return;
      const p = new URLSearchParams({
        pa: data.upi_id as string,
        pn: (data.upi_payee_name as string | null) ?? settings?.store_name ?? "Vaishnavi Store",
        am: (total / 100).toFixed(2),
        cu: "INR",
        tn: orderNo,
      });
      const l = `upi://pay?${p.toString().replace(/\+/g, "%20")}`;
      setVpa(data.upi_id as string);
      setQr(await QRCode.toDataURL(l, { margin: 2, width: 600, errorCorrectionLevel: "M" }));
    })();
  }, [total, orderNo, settings?.store_name]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data } = await supabase().rpc("submit_upi_utr", { p_token: token, p_utr: utr });
    setBusy(false);
    const r = (data ?? { ok: false, message: "Couldn't save. Try again." }) as { ok: boolean; message?: string };
    setMsg(r.ok ? { ok: true, text: "Thanks! The shop will confirm your payment shortly." } : { ok: false, text: r.message ?? "Couldn't save." });
    if (r.ok) onSent();
  }

  return (
    <section className="rounded-[var(--radius-card)] bg-white p-4 text-center ring-1 ring-line">
      <h2 className="text-[17px] font-bold">Pay {formatPaise(total)} with UPI</h2>
      {qr ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`UPI QR code for ${formatPaise(total)}`} className="mx-auto my-3 size-60" />
          <p className="text-[13px] text-muted">Amount {formatPaise(total)} and order number are already in the QR.</p>

          <ol className="mt-4 space-y-2 rounded-2xl bg-page p-3 text-left text-[14px] leading-snug">
            <li><b>1.</b> Tap <b>Save QR</b> below.</li>
            <li><b>2.</b> Open GPay, PhonePe or Paytm → <b>Scan QR</b> → pick the saved photo from your gallery.</li>
            <li><b>3.</b> Pay {formatPaise(total)}. On another phone? Just scan the QR on this screen.</li>
          </ol>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={qr} download={`pay-${orderNo.replace(/\W/g, "")}.png`} className="btn-brand">Save QR</a>
            <button
              type="button"
              className="btn-plain"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(vpa ?? "");
                  setCopied(true);
                } catch {
                  /* ignore */
                }
              }}
            >
              {copied ? "UPI ID copied" : "Copy UPI ID"}
            </button>
          </div>
          {vpa && <p className="mt-2 text-[13px] text-muted">UPI ID: <b className="text-ink">{vpa}</b></p>}
        </>
      ) : (
        <p className="mt-2 text-[15px] text-muted">UPI isn't set up yet. Please pay cash on delivery.</p>
      )}
      {waiting && <p className="mt-3 text-[14px] font-semibold text-haldi-700">Waiting for the shop to confirm your payment.</p>}
      <form onSubmit={send} className="mt-4 text-left">
        <label htmlFor="utr" className="label">Paid? Add the 12-digit UPI reference (optional)</label>
        <div className="flex gap-2">
          <input id="utr" className="field" inputMode="numeric" value={utr} onChange={(e) => setUtr(e.target.value.slice(0, 30))} />
          <button className="btn-brand shrink-0" type="submit" disabled={busy || utr.trim().length < 6}>{busy ? "Sending" : "Send"}</button>
        </div>
        {msg && <p className={`mt-2 text-[14px] ${msg.ok ? "text-brand-700" : "text-rose-700"}`}>{msg.text}</p>}
      </form>
    </section>
  );
}

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RzpInstance = { open: () => void; on: (e: string, f: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RzpInstance;
  }
}

function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const sc = document.createElement("script");
    sc.src = "https://checkout.razorpay.com/v1/checkout.js";
    sc.onload = () => resolve(true);
    sc.onerror = () => resolve(false);
    document.body.appendChild(sc);
  });
}

function OnlinePayBox({ token, total, paid, autoOpen, onPaid }: { token: string; total: number; paid: boolean; autoOpen: boolean; onPaid: () => void }) {
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
    const r = (await fetch("/api/razorpay/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then((x) => x.json())
      .catch(() => null)) as null | { ok: boolean; paid?: boolean; message?: string; key: string; order_id: string; amount: number; name: string; description: string; prefill: Record<string, string> };
    if (!r?.ok) {
      setBusy(false);
      if (r?.paid) return onPaid();
      return setMsg({ ok: false, text: r?.message ?? "Couldn't start payment. Try again." });
    }
    const rzp = new window.Razorpay({
      key: r.key,
      order_id: r.order_id,
      amount: r.amount,
      currency: "INR",
      name: r.name,
      description: r.description,
      image: `${window.location.origin}/icons/icon-192.png`,
      prefill: r.prefill,
      theme: { color: "#e30613" },
      retry: { enabled: false },
      modal: { ondismiss: () => setBusy(false) },
      handler: async (resp: RzpResponse) => {
        setMsg({ ok: true, text: "Payment received. Confirming…" });
        const v = (await fetch("/api/razorpay/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(resp) })
          .then((x) => x.json())
          .catch(() => null)) as null | { ok: boolean; message?: string };
        setBusy(false);
        setMsg(v?.ok ? { ok: true, text: "Paid! Thank you. The shop is preparing your order." } : { ok: false, text: v?.message ?? "We got your payment but couldn't confirm it yet. The shop will check it." });
        onPaid();
      },
    });
    rzp.on("payment.failed", (e) => {
      setBusy(false);
      setFailed(e.error?.description ?? "The payment didn't go through.");
      try {
        (rzp as unknown as { close?: () => void }).close?.();
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

export default function OrderPage() {
  return (
    <>
      <PageBar title="Your order" />
      <Suspense fallback={<p className="py-16 text-center text-muted">Loading your order…</p>}>
        <OrderInner />
      </Suspense>
    </>
  );
}
