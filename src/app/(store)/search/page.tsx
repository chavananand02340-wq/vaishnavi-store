"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { waLink, type CardProduct } from "@/lib/cards";
import { searchProducts } from "@/lib/search";
import { useAsync } from "@/lib/useAsync";
import { useCart } from "@/components/store/cart";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductGrid } from "@/components/store/ProductCard";

function Results() {
  const term = (useSearchParams().get("q") ?? "").trim().slice(0, 60);
  const { settings } = useCart();
  const { data, loading } = useAsync(async (): Promise<CardProduct[]> => searchProducts(term, 40), [term]);
  const wa = waLink(settings?.whatsapp_number, `Hello, do you have "${term}"?`);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4">
      <h1 className="mb-3 font-display text-[20px] font-bold">{term ? `Results for “${term}”` : "Search the shop"}</h1>
      {term.length > 0 && term.length < 2 && <p className="text-muted">Type at least 2 letters.</p>}
      {loading && term.length >= 2 && <p className="text-muted">Searching…</p>}
      {!loading && term.length >= 2 && data?.length === 0 && (
        <div className="rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
          <p className="text-[15px]">Nothing found for “{term}”. Try another word, like “rice” or “oil”.</p>
          {wa && <a href={wa} rel="noopener" className="btn-brand mt-3">Ask the shop on WhatsApp</a>}
        </div>
      )}
      {data && data.length > 0 && <ProductGrid products={data} />}
    </main>
  );
}

export default function SearchPage() {
  return (
    <>
      <StoreHeader compact />
      <Suspense fallback={<p className="p-6 text-muted">Searching…</p>}>
        <Results />
      </Suspense>
    </>
  );
}
