"use client";

import Link from "next/link";
import { formatPaise } from "@/lib/money";
import { useCart } from "@/components/store/cart";
import { useQuote } from "@/components/store/useQuote";
import { Stepper, ProductImage } from "@/components/store/ProductCard";
import { FreeDeliveryMeter } from "@/components/store/CartBar";
import { useOpenNow } from "@/components/store/StoreHeader";
import { PageBar } from "@/components/store/PageBar";
import { Bill } from "@/components/store/Bill";
import { Icon } from "@/components/Icon";

export default function CartPage() {
  const { ready, lines, setQty, remove, subtotal } = useCart();
  const { quote, loading } = useQuote(null);
  const open = useOpenNow();

  if (!ready) return <PageBar title="Your cart" />;

  if (lines.length === 0) {
    return (
      <>
        <PageBar title="Your cart" />
        <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-16 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-leaf-50 text-leaf-700">
            <Icon name="cart" className="size-9" />
          </span>
          <h2 className="mt-4 font-display text-[22px] font-bold">Your cart is empty</h2>
          <p className="mt-1 text-[15px] text-muted">Add atta, dal, oil and daily needs. We'll bring them home.</p>
          <Link href="/" className="btn-leaf mt-6 px-8">Start shopping</Link>
        </main>
      </>
    );
  }

  const unavailable = new Set(quote && !quote.ok ? (quote.unavailable ?? []) : []);
  const short = new Map((quote && !quote.ok ? (quote.insufficient_stock ?? []) : []).map((s) => [s.variant_id, s.available]));
  const problem = quote && !quote.ok;
  const canCheckout = quote?.ok && !quote.below_min_order && open !== false;

  return (
    <>
      <PageBar title="Your cart" />
      <main className="mx-auto max-w-3xl space-y-3 px-3 pb-40 pt-3">
        <div className="rounded-[var(--radius-card)] bg-white p-3 ring-1 ring-line">
          <FreeDeliveryMeter subtotal={quote?.ok ? quote.subtotal_paise : subtotal} />
        </div>

        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-white ring-1 ring-line">
          {lines.map((l) => {
            const gone = unavailable.has(l.variantId);
            const avail = short.get(l.variantId);
            return (
              <li key={l.variantId} className="flex gap-3 p-3">
                <Link href={`/p/${l.productId}`} className="size-[72px] shrink-0 overflow-hidden rounded-xl bg-[#f6f8f5]">
                  <ProductImage src={l.image} alt="" className="p-1" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{l.name}</p>
                  <p className="text-[13px] text-muted">{l.label}</p>
                  {gone && <p className="mt-1 text-[13px] font-semibold text-rose-700">Not available now. Please remove it.</p>}
                  {avail != null && (
                    <p className="mt-1 text-[13px] font-semibold text-rose-700">
                      Only {avail} left.{" "}
                      {avail > 0 && (
                        <button type="button" className="underline" onClick={() => setQty(l.variantId, avail)}>
                          Change to {avail}
                        </button>
                      )}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    {gone ? (
                      <button type="button" className="flex items-center gap-1 text-[14px] font-semibold text-rose-700" onClick={() => remove(l.variantId)}>
                        <Icon name="trash" className="size-4" /> Remove
                      </button>
                    ) : (
                      <Stepper qty={l.qty} max={Math.max(l.max, l.qty)} onChange={(q) => setQty(l.variantId, q)} label={`${l.name} ${l.label}`} />
                    )}
                    <span className="text-[15px] font-extrabold">{formatPaise(l.price * l.qty)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <Link href="/" className="flex items-center justify-center gap-2 rounded-[var(--radius-card)] border-[1.5px] border-dashed border-leaf-200 bg-white py-3 text-[15px] font-bold text-leaf-700">
          <Icon name="plus" className="size-4" strokeWidth={2.6} /> Add more items
        </Link>

        <section className="rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
          <h2 className="mb-3 text-[16px] font-bold">Bill</h2>
          {quote?.ok ? (
            <Bill subtotal={quote.subtotal_paise} fee={quote.delivery_fee_paise} total={quote.total_paise} remaining={quote.free_delivery_remaining_paise} />
          ) : problem ? (
            <p className="text-[15px] text-rose-700">{quote.message}</p>
          ) : (
            <p className="text-[15px] text-muted">{loading ? "Checking today's prices…" : "Prices are confirmed at checkout."}</p>
          )}
          <p className="mt-3 text-[13px] text-muted">Delivery charge for your area is confirmed when you enter your PIN code.</p>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-3xl">
          {open === false && <p className="mb-2 text-center text-[14px] font-semibold text-rose-700">The shop is closed now. Your cart is saved for later.</p>}
          {quote?.ok && quote.below_min_order && quote.min_order_paise != null && (
            <p className="mb-2 text-center text-[14px] font-semibold text-rose-700">Minimum order is {formatPaise(quote.min_order_paise)}.</p>
          )}
          {canCheckout ? (
            <Link href="/checkout" className="btn-haldi w-full text-[17px]">
              Checkout, {formatPaise(quote.total_paise)}
            </Link>
          ) : (
            <button type="button" className="btn-haldi w-full text-[17px]" disabled>
              {loading ? "Checking prices…" : problem ? "Fix the items above" : "Continue"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
