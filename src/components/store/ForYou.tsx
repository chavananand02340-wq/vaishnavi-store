"use client";

import Link from "next/link";
import type { CardProduct } from "@/lib/cards";
import { boughtProductIds, useFavourites, useSavedOrders } from "@/lib/local";
import { Icon } from "@/components/Icon";
import { ProductRow } from "./ProductCard";

/** Rows only this customer sees: things they bought before, and their ❤️ favourites. */
export function ForYou({ catalog }: { catalog: CardProduct[] }) {
  const [orders, ready] = useSavedOrders();
  const favs = useFavourites();
  if (!ready) return null;
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const again = boughtProductIds(orders).map((id) => byId.get(id)).filter((p): p is CardProduct => Boolean(p)).slice(0, 12);
  const loved = favs.ids.map((id) => byId.get(id)).filter((p): p is CardProduct => Boolean(p)).slice(0, 12);
  if (!again.length && !loved.length) return null;

  return (
    <div className="space-y-6">
      {again.length > 0 && (
        <section aria-labelledby="again-h" className="rounded-[20px] bg-sky-50 p-4 pb-3 ring-1 ring-sky-100">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="again-h" className="flex items-center gap-2 font-display text-[20px] font-extrabold">
              <span className="flex size-9 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm" aria-hidden>
                <Icon name="orders" className="size-[18px]" strokeWidth={2.4} />
              </span>
              Order again
            </h2>
            <Link href="/orders" className="rounded-full bg-white px-3 py-1.5 text-[14px] font-bold text-sky-700 shadow-sm">
              My orders
            </Link>
          </div>
          <ProductRow products={again} />
        </section>
      )}
      {loved.length > 0 && (
        <section aria-labelledby="fav-h" className="rounded-[20px] bg-rose-50 p-4 pb-3 ring-1 ring-rose-100">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="fav-h" className="flex items-center gap-2 font-display text-[20px] font-extrabold">
              <span className="flex size-9 items-center justify-center rounded-full bg-white text-rose-600 shadow-sm" aria-hidden>
                <Icon name="heart" className="size-[18px]" fill="currentColor" strokeWidth={2} />
              </span>
              Your favourites
            </h2>
            <Link href="/favourites" className="rounded-full bg-white px-3 py-1.5 text-[14px] font-bold text-rose-600 shadow-sm">
              See all
            </Link>
          </div>
          <ProductRow products={loved} />
        </section>
      )}
    </div>
  );
}
