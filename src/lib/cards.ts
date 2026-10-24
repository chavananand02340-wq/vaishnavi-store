import { activeVariants, comparePrice, effectivePrice, mainImage, type Product } from "@/lib/catalog";

/** Plain, serialisable product shape for client components. */
export type CardVariant = { id: string; label: string; price: number; compare: number | null; stock: number };
export type CardProduct = { id: string; name: string; nameLocal: string | null; image: string | null; categoryId: string; featured: boolean; variants: CardVariant[] };

export function toCard(p: Product): CardProduct | null {
  const variants = activeVariants(p).map((v) => ({
    id: v.id,
    label: v.label,
    price: effectivePrice(v),
    compare: comparePrice(v),
    stock: v.stock_qty,
  }));
  if (variants.length === 0) return null;
  return { id: p.id, name: p.name, nameLocal: p.name_local ?? null, image: mainImage(p), categoryId: p.category_id, featured: p.is_featured, variants };
}

export function inStock(p: CardProduct): boolean {
  return p.variants.some((v) => v.stock > 0);
}

export function waLink(number: string | null | undefined, text: string): string | null {
  if (!number) return null;
  return `https://wa.me/91${number}?text=${encodeURIComponent(text)}`;
}

/** Biggest % saving across the sizes that are in stock (0 if none). */
export function bestDiscount(p: CardProduct): number {
  let best = 0;
  for (const v of p.variants) if (v.compare && v.stock > 0) best = Math.max(best, Math.round(((v.compare - v.price) / v.compare) * 100));
  return best;
}
