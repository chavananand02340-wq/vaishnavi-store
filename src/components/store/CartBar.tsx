"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatPaise } from "@/lib/money";
import { Icon } from "@/components/Icon";
import { useCart } from "./cart";

/** Free-delivery progress — the one place the store spends colour on motion. */
export function FreeDeliveryMeter({ subtotal, dark = false }: { subtotal: number; dark?: boolean }) {
  const { settings: s } = useCart();
  if (!s?.free_delivery_enabled || s.free_delivery_threshold_paise <= 0) return null;
  const pct = Math.min(100, Math.round((subtotal / s.free_delivery_threshold_paise) * 100));
  const left = Math.max(0, s.free_delivery_threshold_paise - subtotal);
  return (
    <div>
      <p className={`text-[13px] font-semibold ${dark ? "text-white" : "text-ink"}`}>
        {left > 0 ? `Add ${formatPaise(left)} more for free delivery` : "Free delivery unlocked"}
      </p>
      <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${dark ? "bg-white/20" : "bg-brand-100"}`}>
        <div
          className="h-full rounded-full bg-haldi-400 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress to free delivery"
        />
      </div>
    </div>
  );
}

export function CartBar() {
  const { ready, count, subtotal, lines } = useCart();
  const path = usePathname();
  if (!ready || count === 0) return null;
  if (path === "/cart" || path === "/checkout" || path.startsWith("/order") || path.startsWith("/p/")) return null;

  const thumbs = lines.slice(-3).reverse();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
      <Link
        href="/cart"
        className="animate-pop mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-brand-800 px-3 py-2.5 text-white shadow-[0_10px_30px_-10px_rgba(8,42,27,.7)]"
      >
        <div className="flex -space-x-3">
          {thumbs.map((l) => (
            <span key={l.variantId} className="size-10 overflow-hidden rounded-lg border-2 border-brand-800 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.image ? <img src={l.image} alt="" className="size-full object-contain" /> : null}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight">
            {count} item{count === 1 ? "" : "s"}, {formatPaise(subtotal)}
          </p>
          <FreeDeliveryMeter subtotal={subtotal} dark />
        </div>
        <span className="flex items-center gap-1 rounded-xl bg-haldi-500 px-3 py-2 text-[15px] font-bold text-brand-900">
          Cart <Icon name="right" className="size-4" strokeWidth={2.6} />
        </span>
      </Link>
    </div>
  );
}
