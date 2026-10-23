import type { Metadata } from "next";
import { getSettings, searchProducts, whatsappLink } from "@/lib/store";
import { ProductGrid } from "@/components/store/ProductCard";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim().slice(0, 60);
  const [results, s] = await Promise.all([searchProducts(term), getSettings()]);
  const wa = whatsappLink(s?.whatsapp_number, `Hello, do you have "${term}"?`);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">
        {term ? <>Results for “{term}”</> : "Search products"}
      </h1>
      {term.length > 0 && term.length < 2 && <p className="text-sm text-neutral-600">Type at least 2 letters.</p>}
      {term.length >= 2 && results.length === 0 && (
        <div className="card space-y-2 text-sm">
          <p>No products found for “{term}”. Try another word (e.g. “tel” or “oil”).</p>
          {wa && <a className="btn-primary" href={wa} rel="noopener">Ask on WhatsApp</a>}
        </div>
      )}
      {results.length > 0 && <ProductGrid products={results} />}
    </div>
  );
}
