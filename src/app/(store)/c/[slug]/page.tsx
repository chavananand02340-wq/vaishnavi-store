import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getCategories } from "@/lib/store-data";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductGrid } from "@/components/store/ProductCard";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  return { title: cat?.name ?? "Category" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const [categories, catalog] = await Promise.all([getCategories(), getCatalog()]);
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();
  const products = catalog.filter((p) => p.categoryId === cat.id);
  const thumb = new Map<string, string | null>();
  for (const p of catalog) if (p.image && !thumb.has(p.categoryId)) thumb.set(p.categoryId, p.image);

  return (
    <>
      <StoreHeader compact />
      <div className="mx-auto flex w-full max-w-6xl flex-1">
        {/* Side shelf list, the quick-commerce way of hopping between aisles */}
        <nav aria-label="Categories" className="no-scrollbar sticky top-[60px] h-[calc(100dvh-60px)] w-[84px] shrink-0 overflow-y-auto border-r border-line bg-white sm:w-[120px]">
          {categories.map((c) => {
            const active = c.id === cat.id;
            const img = thumb.get(c.id);
            return (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 px-1.5 py-3 text-center ${active ? "bg-leaf-50" : ""}`}
              >
                {active && <span className="absolute right-0 top-2 bottom-2 w-1 rounded-l bg-leaf-700" aria-hidden />}
                <span className={`flex size-12 items-center justify-center overflow-hidden rounded-xl ${active ? "bg-white ring-2 ring-leaf-700" : "bg-[#f3f6f2]"}`}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="size-[80%] object-contain" loading="lazy" />
                  ) : (
                    <span className="font-display text-[20px] font-extrabold text-leaf-800/60">{c.name.charAt(0)}</span>
                  )}
                </span>
                <span className={`line-clamp-2 text-[12px] leading-tight ${active ? "font-bold text-leaf-800" : "font-medium text-muted"}`}>{c.name}</span>
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 px-3 pb-10 pt-4">
          <h1 className="font-display text-[22px] font-bold leading-tight">{cat.name}</h1>
          <p className="mb-3 text-[14px] text-muted">{products.length} item{products.length === 1 ? "" : "s"}</p>
          {products.length === 0 ? (
            <p className="rounded-[var(--radius-card)] bg-white p-4 text-[15px] text-muted ring-1 ring-line">Nothing on this shelf yet.</p>
          ) : (
            <ProductGrid products={products} />
          )}
        </main>
      </div>
    </>
  );
}
