"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { formatTime, isOpenNow } from "@/lib/hours";
import { formatPaise } from "@/lib/money";
import { Icon } from "@/components/Icon";
import { useCart } from "./cart";

/** Re-computes open/closed in the browser so cached pages stay accurate. */
export function useOpenNow() {
  const { settings } = useCart();
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    if (!settings) return;
    const tick = () => setOpen(isOpenNow(settings));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [settings]);
  return open;
}

function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
      }}
      className="relative"
    >
      <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
      <input
        name="q"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search atta, tel, biscuits…"
        aria-label="Search products"
        className="w-full rounded-xl bg-white py-3 pl-11 pr-3 text-[16px] text-ink shadow-[0_1px_0_rgba(0,0,0,.06)] outline-none placeholder:text-neutral-400 focus:ring-4 focus:ring-haldi-300"
      />
    </form>
  );
}

export function CartButton() {
  const { ready, count } = useCart();
  return (
    <Link
      href="/cart"
      className="relative flex h-11 items-center gap-1.5 rounded-xl bg-haldi-500 px-3 font-bold text-leaf-900"
      aria-label={`Cart, ${count} items`}
    >
      <Icon name="cart" className="size-5" strokeWidth={2.2} />
      {ready && count > 0 && <span className="min-w-4 text-center text-[15px]">{count}</span>}
    </Link>
  );
}

export function StoreHeader({ compact = false }: { compact?: boolean }) {
  const { settings: s } = useCart();
  const open = useOpenNow();
  const name = s?.store_name ?? "Vaishnavi Store";

  return (
    <>
      <header className="bg-leaf-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-3 pt-4">
          <Link href="/" className="min-w-0 flex-1">
            <span className={`block truncate font-display font-extrabold leading-none tracking-tight ${compact ? "text-[22px]" : "text-[28px]"}`}>
              {name}
            </span>
            {s && (
              <span className="mt-1.5 flex items-center gap-1.5 text-[14px] text-white/85">
                <span className={`size-2 rounded-full ${open === false ? "bg-rose-300" : "bg-haldi-400"}`} aria-hidden />
                {open === false
                  ? `Closed now, opens ${formatTime(s.open_time)}`
                  : `Open till ${formatTime(s.close_time)}, delivery in ${s.default_eta_minutes} min`}
              </span>
            )}
          </Link>
          <CartButton />
        </div>
      </header>
      <div className="sticky top-0 z-30 bg-leaf-700 pb-3 shadow-[0_6px_12px_-10px_rgba(0,0,0,.5)]">
        <div className="mx-auto max-w-6xl px-4">
          <Suspense fallback={<div className="h-12 rounded-xl bg-white" />}>
            <SearchBox />
          </Suspense>
        </div>
      </div>
      {s && !compact && (
        <div className="bg-haldi-500 text-leaf-900">
          <p className="mx-auto max-w-6xl px-4 py-2 text-[14px] font-semibold">
            {s.free_delivery_enabled
              ? `Free delivery above ${formatPaise(s.free_delivery_threshold_paise)}${s.cod_enabled ? ", cash on delivery" : ""}`
              : `Delivery ${formatPaise(s.delivery_fee_paise)}${s.cod_enabled ? ", cash on delivery" : ""}`}
          </p>
        </div>
      )}
      {s && open === false && (
        <div className="bg-rose-50 text-rose-900">
          <p className="mx-auto max-w-6xl px-4 py-2 text-[14px]">
            {s.closed_message ?? `We take orders ${formatTime(s.open_time)} to ${formatTime(s.close_time)}.`} You can still fill your cart.
          </p>
        </div>
      )}
      {s?.announcement && open !== false && (
        <div className="border-b border-line bg-white">
          <p className="mx-auto max-w-6xl px-4 py-2 text-[14px] text-leaf-800">{s.announcement}</p>
        </div>
      )}
    </>
  );
}
