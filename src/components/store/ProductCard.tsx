"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPaise } from "@/lib/money";
import type { CardProduct } from "@/lib/store";
import { MAX_QTY, useCart } from "./cart";

export function QtyStepper({
  qty,
  max,
  onChange,
  label,
}: {
  qty: number;
  max: number;
  onChange: (q: number) => void;
  label: string;
}) {
  const cap = Math.min(MAX_QTY, max);
  return (
    <div className="flex h-10 items-center overflow-hidden rounded-lg bg-brand-600 text-white" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" className="h-full w-10 text-lg font-bold" onClick={() => onChange(qty - 1)} aria-label="Remove one">−</button>
      <span className="min-w-6 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
      <button
        type="button"
        className="h-full w-10 text-lg font-bold disabled:opacity-40"
        onClick={() => onChange(qty + 1)}
        disabled={qty >= cap}
        aria-label="Add one"
      >
        +
      </button>
    </div>
  );
}

export function AddControls({ product, variantId }: { product: CardProduct; variantId: string }) {
  const { add, setQty, qtyOf, ready } = useCart();
  const v = product.variants.find((x) => x.id === variantId) ?? product.variants[0];
  const qty = qtyOf(v.id);

  if (v.stock <= 0) {
    return <span className="flex h-10 items-center justify-center rounded-lg bg-neutral-100 px-3 text-xs font-medium text-neutral-500">Out of stock</span>;
  }
  if (!ready || qty === 0) {
    return (
      <button
        type="button"
        className="h-10 rounded-lg border border-brand-600 bg-white px-4 text-sm font-bold text-brand-700 hover:bg-brand-50"
        onClick={() =>
          add({ variantId: v.id, productId: product.id, name: product.name, label: v.label, price: v.price, image: product.image, max: v.stock })
        }
      >
        ADD
      </button>
    );
  }
  return <QtyStepper qty={qty} max={v.stock} onChange={(q) => setQty(v.id, q)} label={`${product.name} ${v.label}`} />;
}

export function ProductCard({ product }: { product: CardProduct }) {
  const firstInStock = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstInStock.id);
  const v = product.variants.find((x) => x.id === variantId) ?? firstInStock;
  const off = v.compare ? Math.round(((v.compare - v.price) / v.compare) * 100) : 0;

  return (
    <article className="flex flex-col rounded-xl border border-neutral-200 bg-white p-2.5">
      <Link href={`/p/${product.id}`} className="relative block aspect-square overflow-hidden rounded-lg bg-neutral-50">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={product.name} className="size-full object-contain" loading="lazy" decoding="async" />
        ) : (
          <span className="flex size-full items-center justify-center text-3xl text-neutral-300" aria-hidden>🛒</span>
        )}
        {off >= 5 && (
          <span className="absolute left-1.5 top-1.5 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{off}% OFF</span>
        )}
      </Link>
      <Link href={`/p/${product.id}`} className="mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5">
        {product.name}
      </Link>

      {product.variants.length > 1 ? (
        <select
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
          value={v.id}
          onChange={(e) => setVariantId(e.target.value)}
          aria-label={`Size for ${product.name}`}
        >
          {product.variants.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label} — {formatPaise(x.price)}{x.stock <= 0 ? " (out of stock)" : ""}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-1 text-xs text-neutral-500">{v.label}</p>
      )}

      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <div className="leading-tight">
          <p className="text-sm font-bold">{formatPaise(v.price)}</p>
          {v.compare && <p className="text-xs text-neutral-400 line-through">{formatPaise(v.compare)}</p>}
        </div>
        <AddControls product={product} variantId={v.id} />
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: CardProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
