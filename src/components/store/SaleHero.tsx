"use client";

import { useState } from "react";
import type { PublicSettings } from "@/lib/store-data";
import { Icon } from "@/components/Icon";
import { imageUrl } from "@/lib/catalog";

export const COUPON_KEY = "vs-coupon";

const THEMES = {
  festive: { bg: "bg-[#5a0b2e]", text: "text-white", sub: "text-[#ffd9a0]", accent: "text-haldi-400", chip: "bg-haldi-400 text-[#3d0720]", ring: "border-haldi-400/40" },
  red: { bg: "bg-brand-600", text: "text-white", sub: "text-white/85", accent: "text-haldi-300", chip: "bg-white text-brand-700", ring: "border-white/30" },
  green: { bg: "bg-[#0f7a45]", text: "text-white", sub: "text-white/85", accent: "text-haldi-300", chip: "bg-haldi-400 text-[#0b3d22]", ring: "border-white/25" },
  night: { bg: "bg-ink", text: "text-white", sub: "text-white/75", accent: "text-haldi-400", chip: "bg-haldi-400 text-ink", ring: "border-haldi-400/30" },
} as const;

/**
 * The one big banner at the top of the home page.
 * Owner turns on a sale (e.g. "Diwali Sale", 10%) in Shop settings;
 * otherwise it shows the shop's everyday promise.
 */
export function SaleHero({ s, productImages }: { s: PublicSettings | null; productImages: string[] }) {
  const [copied, setCopied] = useState(false);
  const sale = Boolean(s?.sale_enabled && s.sale_title);
  const t = THEMES[sale ? (s?.sale_theme ?? "festive") : "red"] ?? THEMES.red;
  const pct = sale ? s?.sale_percent : null;
  const code = sale ? s?.sale_coupon_code : null;
  const title = sale ? s!.sale_title! : "Groceries & daily needs";
  const subtitle = sale
    ? s?.sale_subtitle || "On your favourite groceries, for a limited time."
    : `Delivered to your door in about ${s?.default_eta_minutes ?? 30} minutes.`;

  async function useCode() {
    if (!code) return;
    try {
      window.localStorage.setItem(COUPON_KEY, code);
      await navigator.clipboard?.writeText(code);
    } catch {
      /* ignore */
    }
    setCopied(true);
  }

  const picture = sale && s?.sale_image_path ? imageUrl(s.sale_image_path) : null;
  if (picture) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={picture} alt={title + (pct ? `, ${pct}% off` : "")} className="aspect-[2/1] w-full object-cover" fetchPriority="high" />
    );
    return (
      <section aria-label={title} className="space-y-2">
        <div className="relative overflow-hidden rounded-[22px] bg-white shadow-[0_14px_30px_-18px_rgba(0,0,0,.45)]">
          {s?.sale_link_url ? <a href={s.sale_link_url}>{img}</a> : img}
          {pct ? (
            <span className="pointer-events-none absolute right-3 top-3 flex size-[76px] rotate-[8deg] flex-col items-center justify-center rounded-full bg-kumkum-600 text-white shadow-lg ring-4 ring-white/90 sm:size-28" aria-hidden>
              <span className="font-display text-[26px] font-extrabold leading-none sm:text-[40px]">{pct}%</span>
              <span className="text-[13px] font-extrabold leading-none tracking-wide sm:text-[18px]">OFF</span>
            </span>
          ) : null}
        </div>
        {code && (
          <button type="button" onClick={useCode} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-600 bg-brand-50 px-4 py-2.5 text-[15px] font-extrabold text-brand-700">
            {copied ? <Icon name="check" className="size-4" strokeWidth={3} /> : <Icon name="tag" className="size-4" strokeWidth={2.4} />}
            {copied ? `${code} will apply at checkout` : `Tap to use code ${code}`}
          </button>
        )}
      </section>
    );
  }

  return (
    <section aria-label={sale ? `${title}${pct ? `, ${pct}% off` : ""}` : "Welcome"} className={`relative overflow-hidden rounded-[22px] ${t.bg} ${t.text}`}>
      {/* festive dots / rings */}
      <span className={`pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border-[22px] ${t.ring}`} aria-hidden />
      <span className={`pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full border-[18px] ${t.ring}`} aria-hidden />
      {sale && s?.sale_theme === "festive" && (
        <span
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{ backgroundImage: "radial-gradient(circle, #ffcf5a 1.4px, transparent 1.6px)", backgroundSize: "22px 22px" }}
          aria-hidden
        />
      )}

      <div className="relative grid grid-cols-[1fr_auto] items-center gap-3 p-5 sm:p-8">
        <div className="min-w-0">
          {sale && <p className={`text-[13px] font-extrabold ${t.accent}`}>Limited time offer</p>}
          <h1 className="font-display text-[30px] font-extrabold leading-[1.02] sm:text-[48px]">{title}</h1>
          <p className={`mt-2 max-w-md text-[14.5px] leading-snug sm:text-[17px] ${t.sub}`}>{subtitle}</p>
          {code ? (
            <button type="button" onClick={useCode} className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-extrabold ${t.chip}`}>
              {copied ? <Icon name="check" className="size-4" strokeWidth={3} /> : <Icon name="tag" className="size-4" strokeWidth={2.4} />}
              {copied ? `${code} will apply at checkout` : `Use code ${code}`}
            </button>
          ) : (
            <a href="#categories" className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[15px] font-extrabold ${t.chip}`}>
              Shop now <Icon name="right" className="size-4" strokeWidth={2.8} />
            </a>
          )}
        </div>

        {pct ? (
          <div className="flex flex-col items-center text-center">
            <span className={`flex items-center gap-1.5 text-[13px] font-extrabold ${t.accent}`} aria-hidden>
              <span className="h-[3px] w-5 rounded bg-current" />
              <span className="h-[3px] w-2.5 rounded bg-current" />
              UP TO
              <span className="h-[3px] w-2.5 rounded bg-current" />
              <span className="h-[3px] w-5 rounded bg-current" />
            </span>
            <span className={`font-display text-[64px] font-extrabold leading-[.9] sm:text-[96px] ${t.accent}`}>
              {pct}
              <span className="text-[34px] sm:text-[52px]">%</span>
            </span>
            <span className="font-display text-[26px] font-extrabold leading-none sm:text-[36px]">OFF</span>
            <span className={`mt-1.5 flex items-center gap-1.5 ${t.accent}`} aria-hidden>
              <span className="h-[3px] w-5 rounded bg-current" />
              <span className="h-[3px] w-2.5 rounded bg-current" />
              <span className="size-[5px] rounded-full bg-current" />
              <span className="h-[3px] w-2.5 rounded bg-current" />
              <span className="h-[3px] w-5 rounded bg-current" />
            </span>
          </div>
        ) : (
          <div className="relative h-32 w-32 sm:h-44 sm:w-52" aria-hidden>
            {productImages.slice(0, 3).map((src, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={k}
                src={src}
                alt=""
                className="absolute left-1/2 top-1/2 size-24 rounded-2xl bg-white object-contain p-1.5 shadow-[0_10px_24px_-10px_rgba(0,0,0,.5)] sm:size-32"
                style={{ transform: `translate(calc(-50% + ${(k - 1) * 34}%), calc(-50% + ${k === 1 ? -6 : 8}%)) rotate(${(k - 1) * 9}deg)`, zIndex: k === 1 ? 3 : 1 }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
