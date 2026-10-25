"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPaise } from "@/lib/money";
import { waLink, type CardProduct } from "@/lib/cards";
import { Icon } from "@/components/Icon";
import { WaIcon } from "@/components/WaIcon";
import { AddButton, ProductImage } from "./ProductCard";
import { useCart } from "./cart";
import { FreeDeliveryMeter } from "./CartBar";

export function ProductDetail({ product, images, description }: { product: CardProduct; images: string[]; description: string | null }) {
  const { settings, count, subtotal } = useCart();
  const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(first.id);
  const [shown, setShown] = useState(0);
  const v = product.variants.find((x) => x.id === variantId) ?? first;
  const off = v.compare ? Math.round(((v.compare - v.price) / v.compare) * 100) : 0;
  const bulk = waLink(settings?.whatsapp_number, `Hello, I need a bigger quantity of ${product.name} (${v.label}). What would the price be?`);

  return (
    <div className="pb-32">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-white ring-1 ring-line md:aspect-square">
            <ProductImage src={images[shown] ?? null} alt={product.name} className="p-4" />
            {off >= 5 && <span className="absolute left-0 top-4 rounded-r-lg bg-kumkum-600 px-2.5 py-1 text-[14px] font-extrabold text-white">{off}% off</span>}
          </div>
          {images.length > 1 && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setShown(i)}
                  className={`size-16 shrink-0 overflow-hidden rounded-xl bg-white ring-2 ${i === shown ? "ring-brand-700" : "ring-line"}`}
                  aria-label={`Photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="size-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <h1 className="font-display text-[26px] font-bold leading-tight">{product.name}</h1>
            {product.nameLocal && <p className="text-[17px] text-muted">{product.nameLocal}</p>}
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-[26px] font-extrabold">{formatPaise(v.price)}</span>
              {v.compare && <span className="text-[16px] text-muted line-through">{formatPaise(v.compare)}</span>}
              {v.compare && <span className="text-[15px] font-bold text-kumkum-600">You save {formatPaise(v.compare - v.price)}</span>}
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-[15px] font-bold">Pack size</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {product.variants.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setVariantId(x.id)}
                  aria-pressed={x.id === v.id}
                  className={`rounded-xl border-[1.5px] px-2 py-2.5 text-left ${x.id === v.id ? "border-brand-700 bg-brand-50" : "border-line bg-white"} ${x.stock <= 0 ? "opacity-55" : ""}`}
                >
                  <span className="block text-[15px] font-bold">{x.label}</span>
                  <span className="block text-[13px] text-muted">{x.stock <= 0 ? "Out of stock" : formatPaise(x.price)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {bulk && (
            <a href={bulk} rel="noopener" className="flex items-center gap-3 rounded-xl bg-white p-3 text-[15px] ring-1 ring-line">
              <WaIcon tone="green" className="size-6" />
              <span className="flex-1">Need more than 20, or a loose quantity? <b className="text-brand-700">Ask on WhatsApp</b></span>
            </a>
          )}

          {description && (
            <section>
              <h2 className="mb-1 text-[15px] font-bold">About this product</h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-muted">{description}</p>
            </section>
          )}
        </div>
      </div>

      {/* Sticky add bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            {count > 0 ? (
              <>
                <Link href="/cart" className="text-[15px] font-bold text-brand-700 underline">
                  View cart ({count}), {formatPaise(subtotal)}
                </Link>
                <FreeDeliveryMeter subtotal={subtotal} />
              </>
            ) : (
              <p className="text-[15px] font-semibold">
                {v.label}, {formatPaise(v.price)}
              </p>
            )}
          </div>
          <AddButton product={product} variantId={v.id} big />
        </div>
      </div>
    </div>
  );
}
