"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase/browser";
import { PRODUCT_SELECT, type Product } from "@/lib/catalog";
import { toCard, type CardProduct } from "@/lib/cards";
import { useFavourites } from "@/lib/local";
import { useAsync } from "@/lib/useAsync";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductGrid } from "@/components/store/ProductCard";
import { GridSkeleton } from "@/components/store/Skeleton";
import { Icon } from "@/components/Icon";

export default function FavouritesPage() {
  const favs = useFavourites();
  const key = favs.ready ? favs.ids.join(",") : "wait";
  const { data, loading } = useAsync(async (): Promise<CardProduct[]> => {
    if (key === "wait" || !favs.ids.length) return [];
    const { data: rows } = await supabase().from("products").select(PRODUCT_SELECT).in("id", favs.ids).eq("is_active", true);
    const order = new Map(favs.ids.map((id, i) => [id, i]));
    return ((rows ?? []) as unknown as Product[])
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map(toCard)
      .filter((c): c is CardProduct => c !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <>
      <StoreHeader compact />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4">
        <h1 className="mb-4 flex items-center gap-2 font-display text-[26px] font-extrabold">
          <Icon name="heart" className="size-7 text-rose-600" fill="currentColor" /> Your favourites
        </h1>
        {!favs.ready || (loading && favs.ids.length) ? (
          <GridSkeleton count={Math.min(6, Math.max(2, favs.ids.length))} />
        ) : !favs.ids.length || !data?.length ? (
          <div className="rounded-[var(--radius-card)] bg-white p-6 text-center ring-1 ring-line">
            <Icon name="heart" className="mx-auto size-12 text-rose-200" />
            <p className="mt-2 text-[17px] font-bold">No favourites yet</p>
            <p className="mt-1 text-[15px] text-muted">Tap the ♡ on any product to keep it here for next time.</p>
            <Link href="/" className="btn-brand mt-4">Browse products</Link>
          </div>
        ) : (
          <ProductGrid products={data} />
        )}
      </main>
    </>
  );
}
