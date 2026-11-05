"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { formatTime, isOpenNow } from "@/lib/hours";
import { formatPaise } from "@/lib/money";
import { Icon } from "@/components/Icon";
import { cleanTerm, searchProducts } from "@/lib/search";
import type { CardProduct } from "@/lib/cards";
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

const HINTS = ["atta", "rice", "dal", "oil", "sugar", "biscuits", "milk", "soap"];

function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CardProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(0);
  const seq = useRef(0);

  // Rotating placeholder: "Search for atta", "Search for rice"…
  useEffect(() => {
    const t = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 2200);
    return () => clearInterval(t);
  }, []);

  // Live suggestions while typing.
  useEffect(() => {
    const term = cleanTerm(q);
    if (term.length < 2) {
      setItems([]);
      setBusy(false);
      return;
    }
    const mine = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const r = await searchProducts(term, 40).catch(() => []);
      if (mine !== seq.current) return;
      setItems(r.slice(0, 6));
      setBusy(false);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function go(term: string) {
    const t = term.trim();
    if (!t) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(t)}`);
  }

  const term = cleanTerm(q);
  const show = open && term.length >= 2;

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
      className="relative"
    >
      <div className="flex items-center rounded-2xl border-2 border-brand-600 bg-white shadow-[0_6px_18px_-10px_rgba(227,6,19,.55)] focus-within:ring-4 focus-within:ring-brand-100">
        <Icon name="search" className="ml-3.5 size-[22px] shrink-0 text-brand-600" strokeWidth={2.4} />
        <input
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={`Search for "${HINTS[hint]}"`}
          aria-label="Search products"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[16px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-neutral-500"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="px-2 text-muted" aria-label="Clear search">
            <Icon name="x" className="size-5" />
          </button>
        )}
        <button type="submit" className="m-1 rounded-xl bg-brand-600 px-4 py-2.5 text-[15px] font-bold text-white">
          Search
        </button>
      </div>

      {show && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-12px_rgba(0,0,0,.35)] ring-1 ring-line">
          {items.length === 0 ? (
            <p className="px-4 py-4 text-[15px] text-muted">{busy ? "Searching…" : `No match for "${term}". Try another word.`}</p>
          ) : (
            <ul>
              {items.map((p) => {
                const v = p.variants[0];
                return (
                  <li key={p.id}>
                    <Link href={`/p/${p.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-page">
                      <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-page">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.image && <img src={p.image} alt="" loading="lazy" decoding="async" className="size-full object-contain" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                        <span className="block text-[13px] text-muted">{v.label}{p.variants.length > 1 ? ` + ${p.variants.length - 1} more` : ""}</span>
                      </span>
                      <span className="shrink-0 text-[15px] font-extrabold">{formatPaise(v.price)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="submit" className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-[15px] font-bold text-brand-700">
            See all results for &quot;{term}&quot; <Icon name="right" className="size-4" strokeWidth={2.6} />
          </button>
        </div>
      )}
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
