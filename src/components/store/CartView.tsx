"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatPaise } from "@/lib/money";
import { useCart, useSyncCartFromQuote } from "./cart";
import { QtyStepper } from "./ProductCard";
import { Totals } from "./Totals";
import { useQuote } from "./useQuote";

export function CartView() {
  const { ready, lines, setQty, remove, delivery } = useCart();
  // PIN code (and any special fee for it) is checked at checkout.
  const { quote, loading } = useQuote(null);
  const sync = useSyncCartFromQuote();

  useEffect(() => {
    if (quote?.ok) sync(quote.lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote]);

  if (!ready) return <p className="py-10 text-center text-neutral-500">Loading cart…</p>;

  if (lines.length === 0) {
    return (
      <div className="card space-y-3 py-10 text-center">
        <p className="text-4xl" aria-hidden>🛒</p>
        <p className="font-semibold">Your cart is empty</p>
        <Link href="/" className="btn-primary">Start shopping</Link>
      </div>
    );
  }

  const unavailable = new Set(quote && !quote.ok ? (quote.unavailable ?? []) : []);
  const short = new Map((quote && !quote.ok ? (quote.insufficient_stock ?? []) : []).map((s) => [s.variant_id, s.available]));
  const blocking = Boolean(quote && !quote.ok);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Your cart</h1>

      <ul className="divide-y divide-neutral-100 rounded-xl bg-white ring-1 ring-neutral-200">
        {lines.map((l) => {
          const gone = unavailable.has(l.variantId);
          const avail = short.get(l.variantId);
          return (
            <li key={l.variantId} className="flex gap-3 p-3">
              <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-neutral-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.image ? <img src={l.image} alt="" className="size-full object-contain" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/p/${l.productId}`} className="line-clamp-2 text-sm font-medium">{l.name}</Link>
                <p className="text-xs text-neutral-500">{l.label} · {formatPaise(l.price)}</p>
                {gone && <p className="mt-1 text-xs font-medium text-red-700">No longer available — please remove.</p>}
                {avail != null && (
                  <p className="mt-1 text-xs font-medium text-red-700">
                    Only {avail} left.{" "}
                    {avail > 0 ? (
                      <button className="underline" type="button" onClick={() => setQty(l.variantId, avail)}>Change to {avail}</button>
                    ) : (
                      "Please remove."
                    )}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  {gone ? (
                    <button type="button" className="btn-danger min-h-9" onClick={() => remove(l.variantId)}>Remove</button>
                  ) : (
                    <QtyStepper qty={l.qty} max={Math.max(l.max, l.qty)} onChange={(q) => setQty(l.variantId, q)} label={`${l.name} ${l.label}`} />
                  )}
                  <span className="text-sm font-semibold">{formatPaise(l.price * l.qty)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="card space-y-3">
        {quote?.ok ? (
          <Totals q={quote} freeEnabled={delivery?.freeEnabled ?? false} />
        ) : quote && blocking ? (
          <p className="text-sm text-red-700">{quote.message}</p>
        ) : (
          <p className="text-sm text-neutral-500">{loading ? "Checking prices…" : "Prices are confirmed at checkout."}</p>
        )}
        {quote?.ok && !quote.store_open && (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-900">The store is closed right now, so orders can't be placed. Your cart is saved.</p>
        )}
        {quote?.ok && quote.below_min_order && quote.min_order_paise != null && (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-900">Minimum order is {formatPaise(quote.min_order_paise)}.</p>
        )}
      </section>

      <div className="sticky bottom-0 -mx-3 border-t border-neutral-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {quote?.ok && quote.store_open && !quote.below_min_order ? (
          <Link href="/checkout" className="btn-primary w-full text-base">
            Checkout · {formatPaise(quote.total_paise)}
          </Link>
        ) : (
          <button className="btn-primary w-full" disabled type="button">
            {loading ? "Checking…" : blocking ? "Fix the items above" : "Checkout"}
          </button>
        )}
        <Link href="/" className="mt-2 block text-center text-sm text-brand-700">+ Add more items</Link>
      </div>
    </div>
  );
}
