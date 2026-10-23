"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatPaise } from "@/lib/money";
import { placeOrder, type Quote } from "@/app/(store)/actions";
import { useCart } from "./cart";
import { Totals } from "./Totals";
import { useQuote } from "./useQuote";
import { PIN_KEY } from "./PincodeChecker";

const DETAILS_KEY = "vs-details-v1";
const IDEM_KEY = "vs-idem";

type Details = { name: string; phone: string; address: string; landmark: string; pincode: string; instructions: string };
const EMPTY: Details = { name: "", phone: "", address: "", landmark: "", pincode: "", instructions: "" };

function idempotencyKey(): string {
  try {
    const existing = window.sessionStorage.getItem(IDEM_KEY);
    if (existing) return existing;
    const k = crypto.randomUUID();
    window.sessionStorage.setItem(IDEM_KEY, k);
    return k;
  } catch {
    return crypto.randomUUID();
  }
}

export function CheckoutForm() {
  const router = useRouter();
  const { ready, lines, clear, delivery } = useCart();
  const [d, setD] = useState<Details>(EMPTY);
  const [payment, setPayment] = useState<"cod" | "upi">("cod");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const keyRef = useRef<string | null>(null);
  const website = useRef<HTMLInputElement>(null);

  useEffect(() => {
    keyRef.current = idempotencyKey();
    try {
      const saved = JSON.parse(window.localStorage.getItem(DETAILS_KEY) ?? "null") as Partial<Details> | null;
      const pin = window.localStorage.getItem(PIN_KEY) ?? "";
      setD({ ...EMPTY, ...(saved ?? {}), pincode: saved?.pincode || pin, instructions: "" });
    } catch {
      /* ignore */
    }
  }, []);

  const pinValid = /^[1-9]\d{5}$/.test(d.pincode);
  const { quote, loading, setQuote } = useQuote(pinValid ? d.pincode : null);
  const q: Quote | null = quote?.ok ? quote : null;

  useEffect(() => {
    if (q && !q.cod_available && q.upi_available) setPayment("upi");
    if (q && q.cod_available && !q.upi_available) setPayment("cod");
  }, [q?.cod_available, q?.upi_available]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <p className="py-10 text-center text-neutral-500">Loading…</p>;
  if (lines.length === 0) {
    return (
      <div className="card space-y-3 py-8 text-center">
        <p className="font-semibold">Your cart is empty</p>
        <Link href="/" className="btn-primary">Shop now</Link>
      </div>
    );
  }

  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setD((prev) => ({ ...prev, [k]: k === "pincode" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value }));
    setError(null);
  };

  type SummaryLine = { variant_id: string; product_name: string; variant_label: string; qty: number; line_total_paise: number };
  const summary: SummaryLine[] = q
    ? q.lines
    : lines.map((l) => ({ variant_id: l.variantId, product_name: l.name, variant_label: l.label, qty: l.qty, line_total_paise: l.price * l.qty }));

  const pinError = quote && !quote.ok && quote.code === "pincode_unavailable" ? quote.message : null;
  const itemsError = quote && !quote.ok && quote.code === "items_changed";
  const canSubmit = Boolean(q && q.store_open && !q.below_min_order && (q.cod_available || q.upi_available)) && !submitting && !loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q || !keyRef.current) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await placeOrder({
        idempotencyKey: keyRef.current,
        name: d.name,
        phone: d.phone,
        address: d.address,
        landmark: d.landmark,
        pincode: d.pincode,
        instructions: d.instructions,
        payment,
        expectedTotal: q.total_paise,
        items: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
        website: website.current?.value ?? "",
      });
      if (res.ok) {
        try {
          const { instructions: _omit, ...keep } = d;
          void _omit;
          window.localStorage.setItem(DETAILS_KEY, JSON.stringify(keep));
          window.localStorage.setItem(PIN_KEY, d.pincode);
          window.sessionStorage.removeItem(IDEM_KEY);
        } catch {
          /* ignore */
        }
        clear();
        router.replace(`/order/${res.public_token}?new=1`);
        return;
      }
      if (res.code === "price_changed" && res.quote) {
        setQuote(res.quote);
        setNotice(`${res.message} New total: ${formatPaise(res.quote.total_paise)}. Tap "Place order" again to confirm.`);
      } else if (res.code === "items_changed") {
        setError("Some items changed. Please review your cart.");
        router.push("/cart");
      } else {
        setError(res.message);
      }
    } catch {
      setError("Network problem. Please try again — your order will not be placed twice.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate={false}>
      <h1 className="text-xl font-bold">Checkout</h1>

      <section className="card space-y-3">
        <h2 className="font-semibold">Delivery details</h2>
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input className="field" id="name" autoComplete="name" value={d.name} onChange={set("name")} minLength={2} maxLength={80} required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Mobile number</label>
          <input className="field" id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={d.phone} onChange={set("phone")} placeholder="10-digit number" maxLength={16} required />
          <p className="hint">The store will call this number if needed.</p>
        </div>
        <div>
          <label className="label" htmlFor="address">House no., building, street, area</label>
          <textarea className="field" id="address" rows={2} autoComplete="street-address" value={d.address} onChange={set("address")} minLength={5} maxLength={300} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="landmark">Landmark (optional)</label>
            <input className="field" id="landmark" value={d.landmark} onChange={set("landmark")} maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="pincode">PIN code</label>
            <input className="field" id="pincode" inputMode="numeric" autoComplete="postal-code" value={d.pincode} onChange={set("pincode")} maxLength={6} required />
          </div>
        </div>
        {pinError && <p className="text-sm font-medium text-red-700" role="alert">{pinError}</p>}
        <div>
          <label className="label" htmlFor="instructions">Note for the store (optional)</label>
          <textarea className="field" id="instructions" rows={2} value={d.instructions} onChange={set("instructions")} maxLength={300} placeholder="e.g. Call before coming, 2nd floor" />
        </div>
        {/* Honeypot: hidden from people, bots fill it. */}
        <input ref={website} name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Payment</h2>
        {(q?.cod_available ?? true) && (
          <label className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
            <input type="radio" name="payment" checked={payment === "cod"} onChange={() => setPayment("cod")} className="size-5 accent-brand-600" />
            <span>
              <span className="block font-medium">Cash on Delivery</span>
              <span className="text-xs text-neutral-500">Pay cash or UPI to the delivery person</span>
            </span>
          </label>
        )}
        {q?.upi_available && (
          <label className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
            <input type="radio" name="payment" checked={payment === "upi"} onChange={() => setPayment("upi")} className="size-5 accent-brand-600" />
            <span>
              <span className="block font-medium">Pay now with UPI</span>
              <span className="text-xs text-neutral-500">Scan the QR on the next screen. The store confirms your payment.</span>
            </span>
          </label>
        )}
        {q && !q.cod_available && !q.upi_available && (
          <p className="text-sm text-red-700">Online payment options are turned off right now. Please call the store.</p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="space-y-1 text-sm">
          {summary.map((l) => (
            <li key={l.variant_id} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{l.qty} × {l.product_name} <span className="text-neutral-500">({l.variant_label})</span></span>
              <span className="shrink-0">{formatPaise(l.line_total_paise)}</span>
            </li>
          ))}
        </ul>
        {q ? <Totals q={q} freeEnabled={delivery?.freeEnabled ?? false} /> : <p className="text-sm text-neutral-500">{loading ? "Calculating…" : pinValid ? "" : "Enter your PIN code to see the delivery charge."}</p>}
        {q && <p className="text-xs text-neutral-500">Expected delivery: about {q.eta_minutes} minutes after the store confirms.</p>}
        {q && !q.store_open && <p className="rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-900">The store is closed right now. Please order during opening hours.</p>}
        {itemsError && <p className="text-sm text-red-700">Some items changed. <Link className="underline" href="/cart">Review cart</Link></p>}
      </section>

      {notice && <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">{notice}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}

      <div className="sticky bottom-0 -mx-3 border-t border-neutral-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button type="submit" className="btn-primary w-full text-base" disabled={!canSubmit}>
          {submitting ? "Placing order…" : q ? `Place order · ${formatPaise(q.total_paise)}` : "Place order"}
        </button>
      </div>
    </form>
  );
}
