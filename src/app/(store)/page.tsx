import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { formatPaise } from "@/lib/money";
import { getCategories, getFeatured, getSettings, whatsappLink } from "@/lib/store";
import { imageUrl } from "@/lib/catalog";
import { ProductGrid } from "@/components/store/ProductCard";
import { PincodeChecker } from "@/components/store/PincodeChecker";

const CATEGORY_EMOJI: [RegExp, string][] = [
  [/atta|rice|dal|grain|flour|pulse/i, "🌾"],
  [/oil|ghee/i, "🫙"],
  [/snack|biscuit|namkeen|chips/i, "🍪"],
  [/dairy|milk|breakfast|bread/i, "🥛"],
  [/beverage|drink|tea|coffee|juice/i, "🧃"],
  [/fruit|vegetable|veg/i, "🥕"],
  [/personal|care|soap|shampoo|bath/i, "🧴"],
  [/clean|household|detergent/i, "🧽"],
  [/masala|spice/i, "🌶️"],
  [/sugar|salt|jaggery/i, "🧂"],
];
const emojiFor = (name: string) => CATEGORY_EMOJI.find(([re]) => re.test(name))?.[1] ?? "🛍️";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <p className="card text-sm">Store is being set up. Please check back soon.</p>;
  }
  const [s, categories, featured] = await Promise.all([getSettings(), getCategories(), getFeatured()]);
  const wa = whatsappLink(s?.whatsapp_number, "Hello, I want to order from Vaishnavi Store.");

  return (
    <div className="space-y-6">
      {s && (
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white">
            <p className="text-lg font-bold leading-snug">Groceries at your door in ~{s.default_eta_minutes} minutes</p>
            <p className="mt-1 text-sm text-white/85">
              {s.free_delivery_enabled
                ? `FREE delivery on orders of ${formatPaise(s.free_delivery_threshold_paise)}+ · ${formatPaise(s.delivery_fee_paise)} below that`
                : `Delivery charge ${formatPaise(s.delivery_fee_paise)}`}
            </p>
            {s.cod_enabled && <p className="mt-2 inline-block rounded bg-white/15 px-2 py-0.5 text-xs">Cash on Delivery · no minimum order</p>}
          </div>
          <PincodeChecker />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">Shop by category</h2>
        {categories.length === 0 ? (
          <p className="card text-sm text-neutral-600">Products are being added. Please check back soon.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {categories.map((c) => {
              const img = imageUrl(c.image_path);
              return (
                <Link key={c.id} href={`/c/${c.slug}`} className="flex flex-col items-center gap-1 rounded-xl bg-white p-2 text-center shadow-sm ring-1 ring-neutral-200">
                  <span className="flex size-12 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {img ? <img src={img} alt="" className="size-full object-cover" /> : emojiFor(c.name)}
                  </span>
                  <span className="line-clamp-2 text-[11px] font-medium leading-tight">{c.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {featured.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Popular right now</h2>
          <ProductGrid products={featured} />
        </section>
      )}

      {wa && (
        <section className="card flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Need something not listed, or a bigger quantity?</p>
            <p className="text-sm text-neutral-600">Message us on WhatsApp and we'll arrange it.</p>
          </div>
          <a href={wa} className="btn-primary shrink-0" rel="noopener">WhatsApp</a>
        </section>
      )}
    </div>
  );
}
