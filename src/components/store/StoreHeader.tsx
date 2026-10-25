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
        className="w-full rounded-xl border border-line bg-page py-3 pl-11 pr-3 text-[16px] text-ink outline-none placeholder:text-neutral-500 focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100"
      />
    </form>
  );
}

export function CartButton() {
  const { ready, count } = useCart();
  return (
    <Link
      href="/cart"
      className="relative flex h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-3 font-bold text-white"
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
      <header className="bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2 pt-3">
          <Link href="/" className="shrink-0" aria-label={`${name}, home`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-compact.png" alt={name} width={403} height={144} className={compact ? "h-9 w-auto" : "h-12 w-auto"} />
          </Link>
          <div className="min-w-0 flex-1" />
          <CartButton />
        </div>
      </header>
      <div className="sticky top-0 z-30 border-b border-line bg-white pb-2.5 pt-1 shadow-[0_8px_16px_-14px_rgba(31,38,48,.5)]">
        <div className="mx-auto max-w-6xl px-4">
          <Suspense fallback={<div className="h-12 rounded-xl bg-page" />}>
            <SearchBox />
          </Suspense>
        </div>
      </div>
      {s && !compact && (
        <div className="overflow-hidden bg-haldi-500 text-ink" aria-label="Shop information">
          <div className="ticker flex w-max py-2 text-[13.5px] font-bold">
            {[0, 1].map((copy) => (
              <ul key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1 || undefined}>
                {[
                  <span key="o" className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${open === false ? "bg-brand-600" : "bg-emerald-600"}`} aria-hidden />
                    {open === false ? `Closed, opens ${formatTime(s.open_time)}` : `Open till ${formatTime(s.close_time)}`}
                  </span>,
                  `${s.default_eta_minutes} min delivery`,
                  s.free_delivery_enabled ? `Free delivery on ${formatPaise(s.free_delivery_threshold_paise)}+` : null,
                  s.cod_enabled ? "Cash on delivery available" : null,
                  s.sale_enabled && s.sale_title ? `${s.sale_title}${s.sale_percent ? `: up to ${s.sale_percent}% off` : ""}${s.sale_coupon_code ? `, code ${s.sale_coupon_code}` : ""}` : null,
                  s.announcement && open !== false ? s.announcement : null,
                  "Order on WhatsApp too",
                ]
                  .filter(Boolean)
                  .map((item, k) => (
                    <li key={k} className="flex shrink-0 items-center whitespace-nowrap">
                      <span className="px-4">{item}</span>
                      <span className="text-[10px] text-ink/50" aria-hidden>●</span>
                    </li>
                  ))}
              </ul>
            ))}
          </div>
        </div>
      )}
      {s && open === false && (
        <div className="bg-rose-50 text-rose-900">
          <p className="mx-auto max-w-6xl px-4 py-2 text-[14px]">
            {s.closed_message ?? `We take orders ${formatTime(s.open_time)} to ${formatTime(s.close_time)}.`} You can still fill your cart.
          </p>
        </div>
      )}
      {s?.announcement && open !== false && compact && (
        <div className="border-b border-line bg-white">
          <p className="mx-auto max-w-6xl px-4 py-2 text-[14px] text-brand-800">{s.announcement}</p>
        </div>
      )}
    </>
  );
}
