"use client";

import Link from "next/link";
import { getProductCards } from "@/services/products";
import { useFavourites } from "@/state/device-store";
import { useAsync } from "@/hooks/useAsync";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductGrid } from "@/components/store/ProductCard";
import { GridSkeleton } from "@/components/store/Skeleton";
import { ErrorState } from "@/components/store/ErrorState";
import { Icon } from "@/components/ui/Icon";
import type { CardProduct } from "@/types/catalog";

export default function FavouritesPage() {
  const favs = useFavourites();
  const key = favs.ready ? favs.ids.join(",") : "wait";
  const { data, loading, error, reload } = useAsync(async (): Promise<CardProduct[]> => {
    if (key === "wait" || !favs.ids.length) return [];
    return getProductCards(favs.ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <>
      <StoreHeader compact />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4">
        <h1 className="mb-4 flex items-center gap-2 font-display text-[26px] font-extrabold">
          <Icon name="heart" className="size-7 text-rose-600" fill="currentColor" /> Your favourites
        </h1>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !favs.ready || (loading && favs.ids.length) ? (
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
