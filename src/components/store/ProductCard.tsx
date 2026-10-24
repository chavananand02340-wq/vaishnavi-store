"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPaise } from "@/lib/money";
import type { CardProduct } from "@/lib/cards";
import { Icon } from "@/components/Icon";
import { MAX_QTY, useCart } from "./cart";

export function Stepper({ qty, max, onChange, label, big = false }: { qty: number; max: number; onChange: (q: number) => void; label: string; big?: boolean }) {
  const cap = Math.min(MAX_QTY, max);
  const size = big ? "h-12 text-[17px]" : "h-9 text-[15px]";
  return (
    <div className={`flex items-center overflow-hidden rounded-lg bg-leaf-700 text-white ${size}`} role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" className={`flex h-full items-center justify-center ${big ? "w-12" : "w-9"}`} onClick={() => onChange(qty - 1)} aria-label="Remove one">
        <Icon name="minus" className="size-4" strokeWidth={3} />
      </button>
      <span className="min-w-6 text-center font-bold" aria-live="polite">{qty}</span>
      <button
        type="button"
        className={`flex h-full items-center justify-center disabled:opacity-40 ${big ? "w-12" : "w-9"}`}
        onClick={() => onChange(qty + 1)}
        disabled={qty >= cap}
        aria-label="Add one"
      >
        <Icon name="plus" className="size-4" strokeWidth={3} />
      </button>
    </div>
  );
}

export function AddButton({ product, variantId, big = false }: { product: CardProduct; variantId: string; big?: boolean }) {
  const { add, setQty, qtyOf, ready } = useCart();
  const v = product.variants.find((x) => x.id === variantId) ?? product.variants[0];
  const qty = qtyOf(v.id);

  if (v.stock <= 0) {
    return (
      <span className={`flex items-center justify-center rounded-lg bg-neutral-100 px-2 font-semibold text-muted ${big ? "h-12 text-[15px]" : "h-9 text-[13px]"}`}>
        Out of stock
      </span>
    );
  }
  if (!ready || qty === 0) {
    return (
      <button
        type="button"
        onClick={() => add({ variantId: v.id, productId: product.id, name: product.name, label: v.label, price: v.price, image: product.image, max: v.stock })}
        className={`rounded-lg border-[1.5px] border-leaf-700 bg-leaf-50 font-extrabold text-leaf-700 transition hover:bg-leaf-100 active:scale-95 ${
          big ? "h-12 px-8 text-[17px]" : "h-9 px-4 text-[15px]"
        }`}
      >
        Add
      </button>
    );
  }
  return <Stepper qty={qty} max={v.stock} onChange={(q) => setQty(v.id, q)} label={`${product.name} ${v.label}`} big={big} />;
}

export function ProductImage({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async" className={`size-full object-contain ${className}`} />
  ) : (
    <span className="flex size-full items-center justify-center text-leaf-200" aria-hidden>
      <Icon name="box" className="size-1/3" strokeWidth={1.4} />
    </span>
  );
}

export function ProductCard({ product, width }: { product: CardProduct; width?: string }) {
  const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(first.id);
  const v = product.variants.find((x) => x.id === variantId) ?? first;
  const off = v.compare ? Math.round(((v.compare - v.price) / v.compare) * 100) : 0;

  return (
    <article className={`flex flex-col rounded-[var(--radius-card)] bg-white p-2 ring-1 ring-line ${width ?? ""}`}>
      <Link href={`/p/${product.id}`} className="relative block aspect-square overflow-hidden rounded-[10px] bg-[#f6f8f5]">
        <ProductImage src={product.image} alt={product.name} className="p-1.5" />
        {off >= 5 && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-kumkum-600 px-2 py-0.5 text-[11.5px] font-extrabold text-white shadow-sm">{off}% OFF</span>
        )}
      </Link>

      <div className="flex flex-1 flex-col px-1 pt-2">
        <Link href={`/p/${product.id}`} className="min-h-[2.6em]">
          <span className="line-clamp-2 text-[14px] font-semibold leading-[1.3]">{product.name}</span>
          {product.nameLocal && <span className="line-clamp-1 text-[12.5px] leading-tight text-muted">{product.nameLocal}</span>}
        </Link>
        {product.variants.length > 1 ? (
          <div className="no-scrollbar -mx-1 mt-1.5 flex gap-1 overflow-x-auto px-1">
            {product.variants.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setVariantId(x.id)}
                aria-pressed={x.id === v.id}
                className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[12px] font-semibold ${
                  x.id === v.id ? "border-leaf-700 bg-leaf-50 text-leaf-800" : "border-line text-muted"
                } ${x.stock <= 0 ? "line-through opacity-60" : ""}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-[13px] text-muted">{v.label}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-1.5 pt-2">
          <div className="leading-tight">
            <p className="text-[15px] font-extrabold">{formatPaise(v.price)}</p>
            {v.compare ? <p className="text-[12px] text-muted line-through">{formatPaise(v.compare)}</p> : null}
          </div>
          <AddButton product={product} variantId={v.id} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: CardProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

export function ProductRow({ products }: { products: CardProduct[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1">
      {products.map((p) => (
        <div key={p.id} className="snap-start">
          <ProductCard product={p} width="w-[148px] sm:w-[172px] h-full" />
        </div>
      ))}
    </div>
  );
}
