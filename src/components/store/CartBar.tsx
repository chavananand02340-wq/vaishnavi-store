"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatPaise } from "@/lib/money";
import { useCart } from "./cart";

/** Sticky bottom bar with cart total and free-delivery progress. */
export function CartBar() {
  const { ready, count, subtotal, delivery } = useCart();
  const path = usePathname();
  if (!ready || count === 0 || path === "/cart" || path === "/checkout" || path.startsWith("/order/")) return null;

  const left = delivery?.freeEnabled ? Math.max(0, delivery.threshold - subtotal) : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto max-w-5xl">
        {delivery?.freeEnabled && (
          <p className="mb-1.5 text-center text-xs text-neutral-600">
            {left > 0 ? (
              <>Add <b>{formatPaise(left)}</b> more for <b className="text-brand-700">FREE delivery</b></>
            ) : (
              <b className="text-brand-700">🎉 You get FREE delivery</b>
            )}
          </p>
        )}
        <Link href="/cart" className="flex items-center justify-between rounded-xl bg-brand-600 px-4 py-3 text-white">
          <span className="text-sm">
            <b>{count} item{count === 1 ? "" : "s"}</b> · {formatPaise(subtotal)}
          </span>
          <span className="text-sm font-bold">View cart ›</span>
        </Link>
      </div>
    </div>
  );
}

export function CartIcon() {
  const { ready, count } = useCart();
  return (
    <Link href="/cart" className="relative flex size-10 items-center justify-center rounded-full bg-white/15" aria-label={`Cart, ${count} items`}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="20" r="1.3" />
        <circle cx="17" cy="20" r="1.3" />
      </svg>
      {ready && count > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-neutral-900">
          {count}
        </span>
      )}
    </Link>
  );
}
