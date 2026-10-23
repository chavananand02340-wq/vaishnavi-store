import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getCategoryProducts } from "@/lib/store";
import { ProductGrid } from "@/components/store/ProductCard";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  return { title: cat ? cat.name : "Category" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const categories = await getCategories();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();
  const products = await getCategoryProducts(cat.id);

  return (
    <div className="space-y-4">
      <nav className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1" aria-label="Categories">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.slug}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${c.id === cat.id ? "bg-brand-600 text-white" : "bg-white text-neutral-700 ring-1 ring-neutral-200"}`}
            aria-current={c.id === cat.id ? "page" : undefined}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <h1 className="text-xl font-bold">{cat.name}</h1>
      {products.length === 0 ? (
        <p className="card text-sm text-neutral-600">No products here yet.</p>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
