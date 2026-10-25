import Link from "next/link";
import { getBanners, getCatalog, getCategories, getSettings } from "@/lib/store-data";
import { bestDiscount, waLink } from "@/lib/cards";
import { imageUrl } from "@/lib/catalog";
import { formatPaise } from "@/lib/money";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductRow } from "@/components/store/ProductCard";
import { PincodeCheck } from "@/components/store/PincodeCheck";
import { HeroSlider } from "@/components/store/HeroSlider";
import { SaleHero } from "@/components/store/SaleHero";
import { Icon } from "@/components/Icon";
import { WaIcon } from "@/components/WaIcon";

// Each shelf gets its own colour so the page feels like a stocked shop.
const TINTS = ["#ffe9a8", "#cdeedb", "#ffd9cf", "#d6e6ff", "#e7dcff", "#c9f0ea", "#fbe0c4", "#e3efc0", "#ffd6ea", "#d9f2c8"];

function SectionHead({ id, title, href, count, dot }: { id: string; title: string; href?: string; count?: number; dot: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 font-display text-[21px] font-bold leading-tight">
        <span className="h-6 w-1.5 rounded-full" style={{ background: dot }} aria-hidden />
        {title}
      </h2>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-0.5 rounded-full bg-brand-50 px-3 py-1.5 text-[14px] font-bold text-brand-700">
          See all{count ? ` ${count}` : ""} <Icon name="right" className="size-4" strokeWidth={2.6} />
        </Link>
      )}
    </div>
  );
}

export default async function Home() {
  const [s, categories, catalog, banners] = await Promise.all([getSettings(), getCategories(), getCatalog(), getBanners()]);
  const byCat = new Map<string, typeof catalog>();
  for (const p of catalog) byCat.set(p.categoryId, [...(byCat.get(p.categoryId) ?? []), p]);
  const featured = catalog.filter((p) => p.featured).slice(0, 14);
  const deals = catalog
    .map((p) => ({ p, d: bestDiscount(p) }))
    .filter((x) => x.d >= 5)
    .sort((a, b) => b.d - a.d)
    .slice(0, 14)
    .map((x) => x.p);
  const images = catalog.filter((p) => p.image).map((p) => p.image!) as string[];
  const wa = waLink(s?.whatsapp_number, "Hello! Here is my grocery list:\n");
  const help = waLink(s?.whatsapp_number, "Hello, I'm looking for an item that isn't on the website.");

  const trust = [
    { icon: "clock", text: `${s?.default_eta_minutes ?? 30} min delivery`, bg: "bg-haldi-100 text-haldi-700" },
    { icon: "rupee", text: s?.cod_enabled ? "Cash on delivery" : "Easy payment", bg: "bg-brand-50 text-brand-800" },
    { icon: "store", text: "Your local shop", bg: "bg-sky-50 text-sky-800" },
    ...(s?.free_delivery_enabled ? [{ icon: "truck", text: `Free delivery ${formatPaise(s.free_delivery_threshold_paise)}+`, bg: "bg-rose-50 text-rose-800" }] : []),
  ];

  return (
    <>
      <StoreHeader />
      <main className="mx-auto w-full max-w-6xl space-y-7 px-4 pb-10 pt-4">
        <SaleHero s={s} productImages={images} />

        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:grid sm:grid-cols-4" aria-label="Why order from us">
          {trust.map((t) => (
            <li key={t.text} className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-bold ${t.bg}`}>
              <Icon name={t.icon} className="size-[18px]" strokeWidth={2.4} /> {t.text}
            </li>
          ))}
        </ul>

        <section id="categories" aria-labelledby="cats" className="scroll-mt-20">
          <SectionHead id="cats" title="Shop by category" dot="#e30613" />
          {categories.length === 0 ? (
            <p className="rounded-[var(--radius-card)] bg-white p-4 text-[15px] text-muted ring-1 ring-line">
              The shelves are being stocked. Please check back in a little while.
            </p>
          ) : (
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
          )}
        </section>

        <HeroSlider banners={banners} productImages={images} />

        {wa && (
          <a href={wa} rel="noopener" className="flex items-center gap-4 overflow-hidden rounded-[20px] bg-[#25d366] p-4 text-[#073b20]">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
              <WaIcon tone="green" className="size-9" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block font-display text-[19px] leading-tight">Busy? Send your list on WhatsApp</b>
              <span className="text-[14px] text-[#073b20]/80">Type it or send a photo of your written list. We'll pack and deliver it.</span>
            </span>
            <Icon name="right" className="size-6 shrink-0" strokeWidth={2.6} />
          </a>
        )}

        {deals.length > 0 && (
          <section id="deals" aria-labelledby="deals-h" className="scroll-mt-20 rounded-[20px] bg-kumkum-50 p-4 pb-3">
            <SectionHead id="deals-h" title="Best deals today" dot="#d92d20" />
            <ProductRow products={deals} />
          </section>
        )}

        {featured.length > 0 && (
          <section aria-labelledby="popular">
            <SectionHead id="popular" title="Shop favourites" dot="#e30613" />
            <ProductRow products={featured} />
          </section>
        )}

        <PincodeCheck />

        {categories.map((c, i) => {
          const items = byCat.get(c.id) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={c.id} aria-labelledby={`row-${c.id}`}>
              <SectionHead id={`row-${c.id}`} title={c.name} href={`/c/${c.slug}`} count={items.length} dot={["#e30613", "#f2b705", "#1f2630", "#2563eb", "#0f7a45"][i % 5]} />
              <ProductRow products={items.slice(0, 10)} />
            </section>
          );
        })}

        {help && (
          <a href={help} rel="noopener" className="flex items-center gap-4 rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
              <Icon name="search" />
            </span>
            <span className="flex-1">
              <b className="block text-[16px]">Can't find something?</b>
              <span className="text-[15px] text-muted">Message us. If it's on our shelf, we'll add it to your order.</span>
            </span>
            <Icon name="right" className="size-5 text-brand-700" />
          </a>
        )}
      </main>
    </>
  );
}
