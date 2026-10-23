"use client";

import { useState } from "react";
import { formatPaise } from "@/lib/money";
import type { CardProduct } from "@/lib/store";
import { AddControls } from "./ProductCard";

export function ProductDetail({ product, images, whatsapp }: { product: CardProduct; images: string[]; whatsapp: string | null }) {
  const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(first.id);
  const [shown, setShown] = useState(0);
  const v = product.variants.find((x) => x.id === variantId) ?? first;

  const bulk = whatsapp
    ? `${whatsapp}?text=${encodeURIComponent(`Hello, I need a bigger quantity of ${product.name} (${v.label}). Please tell me the price.`)}`
    : null;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <div className="aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
          {images[shown] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[shown]} alt={product.name} className="size-full object-contain" />
          ) : (
            <span className="flex size-full items-center justify-center text-6xl text-neutral-300" aria-hidden>🛒</span>
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setShown(i)}
                className={`size-14 shrink-0 overflow-hidden rounded-lg bg-white ring-2 ${i === shown ? "ring-brand-600" : "ring-transparent"}`}
                aria-label={`Photo ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h1 className="text-xl font-bold leading-snug">{product.name}</h1>

        <div>
          <p className="label">Choose size</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setVariantId(x.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${x.id === v.id ? "border-brand-600 bg-brand-50" : "border-neutral-300 bg-white"} ${x.stock <= 0 ? "opacity-60" : ""}`}
                aria-pressed={x.id === v.id}
              >
                <span className="block font-medium">{x.label}</span>
                <span className="block text-xs">{x.stock <= 0 ? "Out of stock" : formatPaise(x.price)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-neutral-200">
          <div>
            <p className="text-2xl font-bold">{formatPaise(v.price)}</p>
            {v.compare && (
              <p className="text-sm text-neutral-500">
                MRP <span className="line-through">{formatPaise(v.compare)}</span>{" "}
                <span className="font-semibold text-brand-700">Save {formatPaise(v.compare - v.price)}</span>
              </p>
            )}
          </div>
          <AddControls product={product} variantId={v.id} />
        </div>

        {bulk && (
          <a href={bulk} rel="noopener" className="block rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700">
            Need more than 20 or a loose quantity? <span className="font-semibold text-brand-700">Ask on WhatsApp ›</span>
          </a>
        )}
      </div>
    </div>
  );
}
