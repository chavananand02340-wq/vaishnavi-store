/**
 * Pure catalogue helpers (no database, safe on server and in the browser).
 * Prices shown here are for display; the database re-prices at checkout.
 */
import { publicEnv } from "@/config/env";
import { IMAGE_BUCKET } from "@/config/site";
import type { CardProduct, Product, Variant } from "@/types/catalog";

/** Columns the storefront and panel read for a product. */
export const PRODUCT_SELECT =
  "id, name, name_local, description, category_id, is_active, is_featured, product_variants(id, label, price_paise, mrp_paise, sale_price_paise, sale_ends_at, stock_qty, is_active, sort_order), product_images(id, storage_path, sort_order)";
export const CATEGORY_SELECT = "id, name, slug, sort_order, is_active, image_path";

/** Public URL of a photo in Supabase Storage. */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${IMAGE_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function mainImage(p: Pick<Product, "product_images">): string | null {
  const first = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
  return imageUrl(first?.storage_path);
}

/** Price the customer pays now (sale price while it is valid). */
export function effectivePrice(v: Variant, now = Date.now()): number {
  if (v.sale_price_paise != null && (!v.sale_ends_at || new Date(v.sale_ends_at).getTime() > now)) return v.sale_price_paise;
  return v.price_paise;
}

/** Strike-through price to show next to the selling price, if any. */
export function comparePrice(v: Variant, now = Date.now()): number | null {
  const pay = effectivePrice(v, now);
  const ref = v.sale_price_paise != null && pay === v.sale_price_paise ? Math.max(v.price_paise, v.mrp_paise ?? 0) : v.mrp_paise;
  return ref != null && ref > pay ? ref : null;
}

export function activeVariants(p: Pick<Product, "product_variants">): Variant[] {
  return [...(p.product_variants ?? [])].filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order || a.price_paise - b.price_paise);
}

/** Database product → small card for the UI. `null` if nothing is on sale. */
export function toCard(p: Product): CardProduct | null {
  const variants = activeVariants(p).map((v) => ({ id: v.id, label: v.label, price: effectivePrice(v), compare: comparePrice(v), stock: v.stock_qty }));
  if (variants.length === 0) return null;
  return { id: p.id, name: p.name, nameLocal: p.name_local ?? null, image: mainImage(p), categoryId: p.category_id, featured: p.is_featured, variants };
}

/** Maps a list and drops products with nothing to sell. */
export const toCards = (list: Product[]): CardProduct[] => list.map(toCard).filter((c): c is CardProduct => c !== null);

export const inStock = (p: CardProduct): boolean => p.variants.some((v) => v.stock > 0);

/** Biggest % saving across the sizes that are in stock (0 if none). */
export function bestDiscount(p: CardProduct): number {
  let best = 0;
  for (const v of p.variants) if (v.compare && v.stock > 0) best = Math.max(best, Math.round(((v.compare - v.price) / v.compare) * 100));
  return best;
}

/** WhatsApp chat link with a ready message, or null if the shop has no number. */
export function waLink(number: string | null | undefined, text: string): string | null {
  if (!number) return null;
  return `https://wa.me/91${number}?text=${encodeURIComponent(text)}`;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "category"
  );
}

/** Adds -2, -3… until the slug is not taken. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  let s = base;
  for (let i = 2; set.has(s); i++) s = `${base}-${i}`;
  return s;
}
