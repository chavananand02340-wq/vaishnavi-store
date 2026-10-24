import Link from "next/link";
import { getCatalog, getCategories, getSettings } from "@/lib/store-data";
import { waLink } from "@/lib/cards";
import { imageUrl } from "@/lib/catalog";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductRow } from "@/components/store/ProductCard";
import { PincodeCheck } from "@/components/store/PincodeCheck";
import { Icon } from "@/components/Icon";

// Soft tints so each category tile reads as its own shelf.
const TINTS = ["#e7f2ea", "#fff1c9", "#fde6e1", "#e4eefc", "#efe7fb", "#e1f4f2", "#f6ebdd", "#eef3d9"];

export default async function Home() {
  const [s, categories, catalog] = await Promise.all([getSettings(), getCategories(), getCatalog()]);
  const byCat = new Map<string, typeof catalog>();
  for (const p of catalog) byCat.set(p.categoryId, [...(byCat.get(p.categoryId) ?? []), p]);
  const featured = catalog.filter((p) => p.featured).slice(0, 14);
  const wa = waLink(s?.whatsapp_number, "Hello, I'm looking for an item that isn't on the website.");

  return (
    <>
      <StoreHeader />
      <main className="mx-auto w-full max-w-6xl space-y-7 px-4 pb-10 pt-4">
        <PincodeCheck />

        <section aria-labelledby="cats">
          <h2 id="cats" className="mb-3 font-display text-[20px] font-bold">Shop by category</h2>
          {categories.length === 0 ? (
            <p className="rounded-[var(--radius-card)] bg-white p-4 text-[15px] text-muted ring-1 ring-line">
              The shelves are being stocked. Please check back in a little while.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 lg:grid-cols-8">
              {categories.map((c, i) => {
                const img = imageUrl(c.image_path) ?? byCat.get(c.id)?.find((p) => p.image)?.image ?? null;
                return (
                  <Link key={c.id} href={`/c/${c.slug}`} className="group flex flex-col items-center gap-1.5 text-center">
                    <span
                      className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl transition group-active:scale-95"
                      style={{ background: TINTS[i % TINTS.length] }}
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" className="size-[78%] object-contain mix-blend-multiply" loading="lazy" />
                      ) : (
                        <span className="font-display text-[28px] font-extrabold text-leaf-800/70">{c.name.charAt(0)}</span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-[12.5px] font-semibold leading-tight">{c.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {featured.length > 0 && (
          <section aria-labelledby="popular">
            <h2 id="popular" className="mb-3 font-display text-[20px] font-bold">Shop favourites</h2>
            <ProductRow products={featured} />
          </section>
        )}

        {categories.map((c) => {
          const items = byCat.get(c.id) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={c.id} aria-labelledby={`row-${c.id}`}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id={`row-${c.id}`} className="font-display text-[20px] font-bold">{c.name}</h2>
                <Link href={`/c/${c.slug}`} className="shrink-0 text-[15px] font-bold text-leaf-700">
                  See all {items.length}
                </Link>
              </div>
              <ProductRow products={items.slice(0, 10)} />
            </section>
          );
        })}

        {wa && (
          <a href={wa} rel="noopener" className="flex items-center gap-4 rounded-[var(--radius-card)] bg-leaf-50 p-4 ring-1 ring-leaf-100">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-leaf-700 text-white">
              <Icon name="chat" />
            </span>
            <span className="flex-1">
              <b className="block text-[16px]">Can't find something?</b>
              <span className="text-[15px] text-muted">Send us a WhatsApp. If it's on our shelf, we'll add it to your order.</span>
            </span>
            <Icon name="right" className="size-5 text-leaf-700" />
          </a>
        )}
      </main>
    </>
  );
}
