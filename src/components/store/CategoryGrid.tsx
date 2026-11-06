import Link from "next/link";
import { imageUrl } from "@/lib/catalog";
import type { CardProduct } from "@/lib/cards";

// Each shelf gets its own colour so the page feels like a stocked shop.
export const TINTS = ["#ffe9a8", "#cdeedb", "#ffd9cf", "#d6e6ff", "#e7dcff", "#c9f0ea", "#fbe0c4", "#e3efc0", "#ffd6ea", "#d9f2c8"];

type Cat = { id: string; name: string; slug: string; image_path: string | null };

export function CategoryGrid({ categories, byCat }: { categories: Cat[]; byCat: Map<string, CardProduct[]> }) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-6">
      {categories.map((c, i) => {
        const own = imageUrl(c.image_path);
        const img = own ?? byCat.get(c.id)?.find((p) => p.image)?.image ?? null;
        const n = byCat.get(c.id)?.length ?? 0;
        return (
          <Link
            key={c.id}
            href={`/c/${c.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl p-1.5 pb-2 transition active:scale-[.97]"
            style={{ background: TINTS[i % TINTS.length] }}
          >
            <span className="relative block aspect-square overflow-hidden rounded-xl bg-white/60">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt=""
                  className={`size-full transition group-hover:scale-105 ${own ? "object-cover" : "object-contain p-2 mix-blend-multiply"}`}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="flex size-full items-center justify-center font-display text-[44px] font-extrabold text-ink/15">{c.name.charAt(0)}</span>
              )}
            </span>
            <span className="mt-1.5 line-clamp-2 px-1 text-center text-[14px] font-extrabold leading-tight text-ink">{c.name}</span>
            {n > 0 && <span className="px-1 text-center text-[12px] font-semibold text-ink/60">{n} item{n === 1 ? "" : "s"}</span>}
          </Link>
        );
      })}
    </div>
  );
}
