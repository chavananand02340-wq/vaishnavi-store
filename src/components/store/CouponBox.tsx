"use client";

import { useEffect, useState } from "react";
import { listCoupons, type PublicCoupon } from "@/lib/checkout";
import { formatPaise } from "@/lib/money";
import { Icon } from "@/components/Icon";

export function couponLabel(c: PublicCoupon) {
  const off = c.kind === "percent" ? `${c.value}% off` : `${formatPaise(c.value)} off`;
  const cap = c.kind === "percent" && c.max_discount_paise ? ` up to ${formatPaise(c.max_discount_paise)}` : "";
  const min = c.min_order_paise > 0 ? ` on orders above ${formatPaise(c.min_order_paise)}` : "";
  return `${off}${cap}${min}`;
}

/**
 * Coupon section on checkout: shows offers the shop has made visible,
 * lets the customer type a code, and shows the applied coupon with a Remove button.
 */
export function CouponBox({
  applied,
  saving,
  error,
  subtotal,
  onApply,
  onRemove,
}: {
  applied: string | null;
  saving: number;
  error: string | null;
  subtotal: number;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const [offers, setOffers] = useState<PublicCoupon[]>([]);
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    listCoupons().then(setOffers).catch(() => setOffers([]));
  }, []);

  function apply(code: string) {
    const c = code.trim().toUpperCase().replace(/\s+/g, "");
    if (!c) return;
    onApply(c);
    setTyped("");
    setOpen(false);
  }

  return (
    <section className="rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold">
        <Icon name="tag" className="size-5 text-brand-700" /> Coupons & offers
      </h2>

      {applied && !error ? (
        <div className="flex items-center gap-3 rounded-xl border-[1.5px] border-dashed border-emerald-600 bg-emerald-50 px-3 py-3">
          <Icon name="check" className="size-5 shrink-0 text-emerald-700" strokeWidth={3} />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-extrabold tracking-wide text-emerald-800">{applied}</p>
            <p className="text-[14px] text-emerald-800">{saving > 0 ? `You save ${formatPaise(saving)}` : "Applied"}</p>
          </div>
          <button type="button" onClick={onRemove} className="rounded-lg px-3 py-2 text-[14px] font-bold text-rose-700 hover:bg-rose-50">
            Remove
          </button>
        </div>
      ) : (
        <>
          {error && (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2.5 text-[14px] font-semibold text-rose-800" role="alert">
              {applied ? `${applied}: ` : ""}{error}
            </p>
          )}
          <div className="flex gap-2">
            <label htmlFor="coupon" className="sr-only">Coupon code</label>
            <input
              id="coupon"
              className="field uppercase tracking-wide"
              placeholder="Enter coupon code"
              value={typed}
              maxLength={20}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  apply(typed);
                }
              }}
            />
            <button type="button" onClick={() => apply(typed)} disabled={typed.trim().length < 3} className="btn-plain shrink-0 px-5">
              Apply
            </button>
          </div>
        </>
      )}

      {offers.length > 0 && (
        <div className="mt-3">
          <ul className="space-y-2">
            {(open ? offers : offers.slice(0, 2)).map((c) => {
              const short = c.min_order_paise > subtotal ? c.min_order_paise - subtotal : 0;
              const isOn = applied === c.code && !error;
              return (
                <li key={c.code} className="flex items-center gap-3 rounded-xl bg-page px-3 py-2.5">
                  <span className="rounded-md border border-dashed border-brand-600 bg-white px-2 py-1 text-[13px] font-extrabold tracking-wide text-brand-700">{c.code}</span>
                  <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
                    {c.description || couponLabel(c)}
                    {short > 0 && <span className="block text-muted">Add {formatPaise(short)} more to use</span>}
                  </span>
                  {isOn ? (
                    <span className="text-[13px] font-bold text-emerald-700">Applied</span>
                  ) : (
                    <button type="button" disabled={short > 0} onClick={() => apply(c.code)} className="rounded-lg px-2.5 py-1.5 text-[14px] font-bold text-brand-700 hover:bg-brand-50 disabled:text-muted disabled:hover:bg-transparent">
                      Apply
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {offers.length > 2 && (
            <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 text-[14px] font-bold text-brand-700">
              {open ? "Show fewer offers" : `See all ${offers.length} offers`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
