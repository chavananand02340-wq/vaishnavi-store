"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Banner } from "@/lib/store-data";
import { formatPaise } from "@/lib/money";
import { waLink } from "@/lib/cards";
import { Icon } from "@/components/Icon";
import { useCart } from "./cart";

type Slide =
  | { kind: "image"; id: string; image: string; link: string | null; alt: string }
  | { kind: "built"; id: string; bg: string; ink: string; title: string; text: string; cta: string; href: string; external?: boolean; images: string[]; accent: string };

/**
 * Home banner slider. Shows the owner's uploaded banners; until there are
 * any, it shows three ready-made banners built from the shop's own data.
 */
export function HeroSlider({ banners, productImages }: { banners: Banner[]; productImages: string[] }) {
  const { settings: s } = useCart();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  const imgs = (k: number) => productImages.slice(k * 3, k * 3 + 3).concat(productImages).slice(0, 3);
  const wa = waLink(s?.whatsapp_number, "Hello! Here is my grocery list:\n");

  const slides: Slide[] = banners.length
    ? banners.map((b) => ({ kind: "image", id: b.id, image: b.image, link: b.link, alt: b.alt ?? "Offer at Vaishnavi Store" }))
    : [
        {
          kind: "built", id: "b1", bg: "bg-haldi-500", ink: "text-ink", accent: "bg-brand-600 text-white",
          title: "Your whole month's ration, in one go",
          text: "Atta, dal, oil, masale and daily needs. Pay cash when it arrives.",
          cta: "Start shopping", href: "#categories", images: imgs(0),
        },
        {
          kind: "built", id: "b2", bg: "bg-ink", ink: "text-white", accent: "bg-haldi-500 text-ink",
          title: s?.free_delivery_enabled ? `Free delivery on ${formatPaise(s.free_delivery_threshold_paise)} and above` : "Fresh stock, fair prices",
          text: s?.free_delivery_enabled ? `Smaller orders pay just ${formatPaise(s.delivery_fee_paise)}. No minimum order.` : "Same prices as the shop counter.",
          cta: "Fill your cart", href: "#deals", images: imgs(1),
        },
        ...(wa
          ? [{
              kind: "built" as const, id: "b3", bg: "bg-[#25d366]", ink: "text-[#073b20]", accent: "bg-[#073b20] text-white",
              title: "Send your list on WhatsApp",
              text: "Type it or send a photo of your handwritten list. We pack it and deliver.",
              cta: "Open WhatsApp", href: wa, external: true, images: imgs(2),
            }]
          : []),
      ];

  // Gentle auto-advance; stops while the person is touching it.
  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      const el = track.current;
      if (!el || paused.current || document.visibilityState !== "visible") return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <section aria-label="Offers" className="relative">
      <div
        ref={track}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-[20px]"
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onPointerDown={() => (paused.current = true)}
        onPointerUp={() => setTimeout(() => (paused.current = false), 4000)}
      >
        {slides.map((sl, i) => (
          <div key={sl.id} className="w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`}>
            {sl.kind === "image" ? (
              <BannerImage s={sl} />
            ) : (
              <BuiltBanner s={sl} />
            )}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {slides.map((sl, i) => (
            <button
              key={sl.id}
              type="button"
              aria-label={`Show banner ${i + 1}`}
              onClick={() => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" })}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-brand-700" : "w-2 bg-brand-200"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BannerImage({ s }: { s: Extract<Slide, { kind: "image" }> }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={s.image} alt={s.alt} className="aspect-[2/1] w-full rounded-[20px] object-cover sm:aspect-[3/1]" />;
  if (!s.link) return img;
  return s.link.startsWith("/") ? <Link href={s.link}>{img}</Link> : <a href={s.link} rel="noopener">{img}</a>;
}

function BuiltBanner({ s }: { s: Extract<Slide, { kind: "built" }> }) {
  const cta = (
    <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[15px] font-extrabold ${s.accent}`}>
      {s.cta} <Icon name="right" className="size-4" strokeWidth={2.8} />
    </span>
  );
  const body = (
    <div className={`relative flex aspect-[2/1] min-h-[176px] w-full overflow-hidden rounded-[20px] sm:aspect-[3/1] ${s.bg} ${s.ink}`}>
      {/* decorative rings, like a price sticker */}
      <span className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full border-[18px] border-current opacity-10" aria-hidden />
      <span className="pointer-events-none absolute -bottom-16 left-1/3 size-36 rounded-full border-[14px] border-current opacity-[.07]" aria-hidden />
      <div className="relative z-10 flex w-[62%] flex-col justify-center p-4 sm:w-1/2 sm:p-8">
        <p className="font-display text-[22px] font-extrabold leading-[1.08] sm:text-[36px]">{s.title}</p>
        <p className="mt-1.5 text-[13.5px] leading-snug opacity-90 sm:text-[17px]">{s.text}</p>
        <div>{cta}</div>
      </div>
      <div className="absolute inset-y-0 right-0 flex w-[42%] items-center justify-center sm:w-1/2">
        {s.images.slice(0, 3).map((src, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={k}
            src={src}
            alt=""
            className="absolute size-[58%] rounded-2xl bg-white object-contain p-1.5 shadow-[0_10px_24px_-10px_rgba(0,0,0,.45)] sm:size-[42%]"
            style={{ transform: `translate(${(k - 1) * 30}%, ${k === 1 ? -8 : 10}%) rotate(${(k - 1) * 8}deg)`, zIndex: k === 1 ? 3 : 1 }}
          />
        ))}
      </div>
    </div>
  );
  if (s.external) return <a href={s.href} rel="noopener">{body}</a>;
  return <a href={s.href}>{body}</a>;
}
