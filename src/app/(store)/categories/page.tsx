import type { Metadata } from "next";
import { getCatalog, getCategories } from "@/services/catalog";
import { StoreHeader } from "@/components/store/StoreHeader";
import { CategoryGrid } from "@/components/store/CategoryGrid";

export const metadata: Metadata = { title: "All categories", alternates: { canonical: "/categories" } };

export default async function CategoriesPage() {
  const [categories, catalog] = await Promise.all([getCategories(), getCatalog()]);
  const byCat = new Map<string, typeof catalog>();
  for (const p of catalog) byCat.set(p.categoryId, [...(byCat.get(p.categoryId) ?? []), p]);
  return (
    <>
      <StoreHeader compact />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4">
        <h1 className="mb-1 font-display text-[26px] font-extrabold">All categories</h1>
        <p className="mb-4 text-[15px] text-muted">{catalog.length} products in {categories.length} categories</p>
        {categories.length ? (
          <CategoryGrid categories={categories} byCat={byCat} />
        ) : (
          <p className="rounded-[var(--radius-card)] bg-white p-4 text-muted ring-1 ring-line">The shelves are being stocked. Please check back soon.</p>
        )}
      </main>
    </>
  );
}
