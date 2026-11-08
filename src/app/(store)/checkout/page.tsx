"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatPaise } from "@/lib/money";
import { placeOrder, requestOrderEmail, setOrderLocation } from "@/services/checkout";
import { useCart } from "@/state/cart";
import { useQuote } from "@/hooks/useQuote";
import { PageBar } from "@/components/store/PageBar";
import { Bill } from "@/components/store/Bill";
import { CouponBox } from "@/components/store/CouponBox";
import {
  checkoutAttemptKey,
  endCheckoutAttempt,
  getSavedCoupon,
  getSavedDetails,
  getSavedPin,
  saveCoupon as rememberCoupon,
  saveDetails,
  saveOrder,
  savePin,
} from "@/state/device-store";
import { EMPTY_DETAILS, checkDetails, detailsToRemember, fullAddress, normalizeMobile, type Details } from "@/lib/checkout-form";
import { isPincode } from "@/lib/validation";
import { type Spot } from "@/lib/geolocation";
import { LocationButton } from "@/components/store/LocationButton";
import { TrustBadges } from "@/components/store/TrustBadges";
import { Icon } from "@/components/ui/Icon";
import { type Quote } from "@/types/order";
import { lookupPincode, type Place } from "@/services/location";

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-[13px] font-semibold text-rose-700">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { ready, lines, clear } = useCart();
  const [d, setD] = useState<Details>(EMPTY_DETAILS);
  const [payment, setPayment] = useState<"cod" | "upi" | "online">("cod");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [coupon, setCoupon] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    keyRef.current = checkoutAttemptKey();
    const saved = getSavedDetails<Details>();
    setD({ ...EMPTY_DETAILS, ...(saved ?? {}), pincode: saved?.pincode || getSavedPin() || "", instructions: "" });
    setCoupon(getSavedCoupon());
  }, []);

  const pinValid = isPincode(d.pincode);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [areas, setAreas] = useState<string[]>([]);

  // PIN code → city, state and area names (fills empty boxes only).
  useEffect(() => {
    setAreas([]);
    if (!pinValid) return;
    let live = true;
    lookupPincode(d.pincode).then((r) => {
      if (!live || !r.ok) return;
      setAreas(r.areas ?? []);
      setD((prev) => ({ ...prev, city: r.city ?? prev.city, state: r.state ?? prev.state }));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.pincode, pinValid]);

  function applyPlace(p: Place) {
    setD((prev) => {
      const area = p.area && !prev.address.toLowerCase().includes(p.area.toLowerCase()) ? p.area : "";
      return {
        ...prev,
        pincode: p.pincode ?? prev.pincode,
        city: p.city ?? prev.city,
        state: p.state ?? prev.state,
        address: prev.address.trim() ? prev.address : area ? `, ${area}` : prev.address,
      };
    });
    setTimeout(() => (document.getElementById("address") as HTMLTextAreaElement | null)?.focus(), 50);
  }
  const { quote, loading, setQuote } = useQuote(pinValid ? d.pincode : null, coupon);
  const q: Quote | null = quote?.ok ? quote : null;

  useEffect(() => {
    if (!q) return;
    const on = { cod: q.cod_available, upi: q.upi_available, online: Boolean(q.online_available) };
    if (!on[payment]) setPayment(on.online ? "online" : on.cod ? "cod" : on.upi ? "upi" : payment);
  }, [q?.cod_available, q?.upi_available, q?.online_available]); // eslint-disable-line react-hooks/exhaustive-deps

  function saveCoupon(c: string | null) {
    setCoupon(c);
    rememberCoupon(c);
  }

  if (!ready) return <PageBar title="Checkout" back="/cart" />;
  if (lines.length === 0) {
    return (
      <>
        <PageBar title="Checkout" back="/" />
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="font-display text-[22px] font-bold">Your cart is empty</p>
          <Link href="/" className="btn-brand mt-6 px-8">Shop now</Link>
        </main>
      </>
    );
  }

  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = k === "pincode" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value;
    setD((prev) => ({ ...prev, [k]: v }));
    setError(null);
  };

  const phoneDigits = normalizeMobile(d.phone);
  const errs = checkDetails(d);
  const pinError = quote && !quote.ok && quote.code === "pincode_unavailable" ? quote.message : null;
  const hasErrors = Object.values(errs).some(Boolean);
  const canSubmit = Boolean(q && q.store_open && !q.below_min_order && (q.cod_available || q.upi_available || q.online_available)) && !submitting && !loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (hasErrors || !q || !keyRef.current) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    const res = await placeOrder({
      idempotencyKey: keyRef.current,
      name: d.name.trim(),
      phone: phoneDigits,
      address: fullAddress(d),
      landmark: d.landmark.trim(),
      pincode: d.pincode,
      instructions: d.instructions.trim(),
      payment,
      coupon: q.coupon ? q.coupon.code : null,
      email: d.email.trim(),
      expectedTotal: q.total_paise,
      items: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    });
    setSubmitting(false);
    if (res.ok) {
      saveDetails(detailsToRemember(d));
      savePin(d.pincode);
      endCheckoutAttempt();
      rememberCoupon(null);
      // Location is a bonus (waits at most 3 s); the address is already saved.
      if (spot && !res.duplicate) await setOrderLocation(res.public_token, spot);
      if (!res.duplicate && payment !== "online") requestOrderEmail(res.public_token);
      saveOrder({
        token: res.public_token,
        no: res.order_no,
        at: new Date().toISOString(),
        total: q?.total_paise ?? 0,
        lines: lines.map((l) => ({ variantId: l.variantId, productId: l.productId, name: l.name, label: l.label, price: l.price, image: l.image, qty: l.qty })),
      });
      clear();
      router.replace(`/order?t=${res.public_token}&new=1${payment === "online" ? "&pay=1" : ""}`);
      return;
    }
    if (res.code === "price_changed" && res.quote) {
      setQuote(res.quote);
      setNotice(`Prices changed a moment ago. Your new total is ${formatPaise(res.quote.total_paise)}. Tap Place order again to confirm.`);
    } else if (res.code === "coupon_invalid") {
      setError(`${res.message} We removed the coupon. Check the new total and tap Place order again.`);
      saveCoupon(null);
    } else if (res.code === "items_changed") {
      router.push("/cart");
    } else {
      setError(res.message);
    }
  }

  const err = (k: keyof typeof errs) => (touched ? errs[k] : null);

  return (
    <>
      <PageBar title="Checkout" back="/cart" />
      <form onSubmit={submit} noValidate className="mx-auto w-full min-w-0 max-w-3xl space-y-3 px-3 pb-40 pt-3">
        <section className="space-y-4 rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
          <h2 className="flex items-center gap-2 text-[17px] font-bold">
            <Icon name="pin" className="size-5 text-brand-700" /> Where should we deliver?
          </h2>
          <Field id="name" label="Your name" error={err("name")}>
            <input id="name" className="field" autoComplete="name" value={d.name} onChange={set("name")} maxLength={80} />
          </Field>
          <Field id="phone" label="Mobile number" hint="The shop calls this number if needed." error={err("phone")}>
            <div className="flex">
              <span className="flex items-center rounded-l-xl border border-r-0 border-line bg-page px-3 text-[16px] text-muted">+91</span>
              <input id="phone" className="field rounded-l-none" type="tel" inputMode="numeric" autoComplete="tel-national" value={d.phone} onChange={set("phone")} maxLength={14} />
            </div>
          </Field>
          <Field id="email" label="Email (optional)" hint="We'll email your order receipt." error={err("email")}>
            <input id="email" className="field" type="email" inputMode="email" autoComplete="email" value={d.email} onChange={set("email")} maxLength={120} placeholder="you@gmail.com" />
          </Field>
          <LocationButton spot={spot} onSpot={setSpot} onPlace={applyPlace} />
          <Field id="address" label="House no., building, street, area" error={err("address")}>
            <textarea id="address" className="field min-h-[84px]" autoComplete="street-address" value={d.address} onChange={set("address")} maxLength={240} placeholder="Flat 2, Lucky Tower, Station Road" />
          </Field>
          <div className="grid grid-cols-[1fr_8.5rem] gap-3">
            <Field id="landmark" label="Landmark (optional)">
              <input id="landmark" className="field" value={d.landmark} onChange={set("landmark")} maxLength={120} placeholder="Near temple, school…" />
            </Field>
            <Field id="pincode" label="PIN code" error={err("pincode") ?? pinError}>
              <input id="pincode" className="field" inputMode="numeric" autoComplete="postal-code" value={d.pincode} onChange={set("pincode")} maxLength={6} />
            </Field>
          </div>
          {areas.length > 0 && (
            <div className="min-w-0 overflow-hidden">
              <p className="mb-1.5 text-[13px] font-semibold text-muted">Your area? Tap to add</p>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {areas.map((a) => {
                  const has = d.address.toLowerCase().includes(a.toLowerCase());
                  return (
                    <button
                      key={a}
                      type="button"
                      disabled={has}
                      onClick={() => setD((p) => ({ ...p, address: p.address.trim() ? `${p.address.trim().replace(/,$/, "")}, ${a}` : a }))}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ${has ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-white ring-line"}`}
                    >
                      {has ? "✓ " : "+ "}
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field id="city" label="City / District">
              <input id="city" className="field" autoComplete="address-level2" value={d.city} onChange={set("city")} maxLength={60} placeholder="Wardha" />
            </Field>
            <Field id="state" label="State">
              <input id="state" className="field" autoComplete="address-level1" value={d.state} onChange={set("state")} maxLength={60} placeholder="Maharashtra" />
            </Field>
          </div>
          <Field id="instructions" label="Note for the shop (optional)">
            <input id="instructions" className="field" value={d.instructions} onChange={set("instructions")} maxLength={300} placeholder="Call before coming, 2nd floor…" />
          </Field>
        </section>

        <CouponBox
          applied={coupon}
          saving={q?.discount_paise ?? 0}
          error={coupon && q?.coupon_error ? q.coupon_error : null}
          subtotal={q?.subtotal_paise ?? 0}
          onApply={(c) => saveCoupon(c)}
          onRemove={() => saveCoupon(null)}
        />

        <section className="space-y-2 rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
          <h2 className="mb-1 flex items-center gap-2 text-[17px] font-bold">
            <Icon name="rupee" className="size-5 text-brand-700" /> How will you pay?
          </h2>
          {q?.online_available && (
            <PayOption
              checked={payment === "online"}
              onSelect={() => setPayment("online")}
              title="Pay online"
              text="UPI (GPay, PhonePe, Paytm), cards or netbanking. Secure payment by Razorpay."
            />
          )}
          {(q?.cod_available ?? true) && (
            <PayOption checked={payment === "cod"} onSelect={() => setPayment("cod")} title="Cash on delivery" text="Pay cash or UPI to the delivery person." />
          )}
          {q?.upi_available && (
            <PayOption checked={payment === "upi"} onSelect={() => setPayment("upi")} title="Pay now with UPI" text="Scan a QR on the next screen. The shop confirms your payment." />
          )}
          {q && !q.cod_available && !q.upi_available && !q.online_available && <p className="text-[15px] text-rose-700">Online payment is off right now. Please call the shop.</p>}
        </section>

        <TrustBadges compact online={Boolean(q?.online_available)} />

        <section className="rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between text-[17px] font-bold">
              {lines.reduce((n, l) => n + l.qty, 0)} items
              <span className="text-[14px] font-semibold text-brand-700">Show</span>
            </summary>
            <ul className="mt-3 space-y-1.5 text-[15px]">
              {(q?.lines ?? []).map((l) => (
                <li key={l.variant_id} className="flex justify-between gap-3">
                  <span className="min-w-0">{l.qty} × {l.product_name} <span className="text-muted">({l.variant_label})</span></span>
                  <span className="shrink-0 font-semibold">{formatPaise(l.line_total_paise)}</span>
                </li>
              ))}
            </ul>
          </details>
          <div className="mt-4">
            {q ? (
              <Bill subtotal={q.subtotal_paise} fee={q.delivery_fee_paise} total={q.total_paise} remaining={q.free_delivery_remaining_paise} discount={q.discount_paise} coupon={q.coupon?.code} />
            ) : (
              <p className="text-[15px] text-muted">{loading ? "Working out your bill…" : pinValid ? "" : "Enter your PIN code to see the delivery charge."}</p>
            )}
          </div>
          {q && (
            <p className="mt-3 flex items-center gap-2 text-[14px] text-muted">
              <Icon name="clock" className="size-4" /> Reaches you about {q.eta_minutes} minutes after the shop confirms.
            </p>
          )}
        </section>

        {notice && <p className="rounded-xl bg-haldi-100 px-4 py-3 text-[15px] font-semibold text-haldi-700" role="status">{notice}</p>}
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-[15px] font-semibold text-rose-800" role="alert">{error}</p>}
        {q && !q.store_open && <p className="rounded-xl bg-rose-50 px-4 py-3 text-[15px] font-semibold text-rose-800">The shop is closed now. Please order during opening hours.</p>}

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-3xl">
            <button type="submit" className="btn-haldi w-full text-[17px]" disabled={!canSubmit}>
              {submitting ? "Placing your order…" : q ? `${payment === "online" ? "Pay" : "Place order,"} ${formatPaise(q.total_paise)}` : "Place order"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function PayOption({ checked, onSelect, title, text }: { checked: boolean; onSelect: () => void; title: string; text: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3 ${checked ? "border-brand-700 bg-brand-50" : "border-line"}`}>
      <input type="radio" name="payment" checked={checked} onChange={onSelect} className="mt-1 size-5 accent-[var(--color-brand-700)]" />
      <span>
        <span className="block text-[16px] font-bold">{title}</span>
        <span className="text-[14px] text-muted">{text}</span>
      </span>
    </label>
  );
}
