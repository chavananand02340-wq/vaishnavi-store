/** Shared catalogue types and helpers (safe for server and client). */

export type Variant = {
  id: string;
  label: string;
  price_paise: number;
  mrp_paise: number | null;
  sale_price_paise: number | null;
  sale_ends_at: string | null;
  stock_qty: number;
  is_active: boolean;
  sort_order: number;
};

export type ProductImage = { id?: string; storage_path: string; sort_order: number };

export type Product = {
  id: string;
  name: string;
  description: string | null;
  search_keywords?: string | null;
  category_id: string;
  is_active: boolean;
  is_featured: boolean;
  product_variants: Variant[];
  product_images: ProductImage[];
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  image_path: string | null;
};

export const PRODUCT_SELECT =
  "id, name, description, category_id, is_active, is_featured, product_variants(id, label, price_paise, mrp_paise, sale_price_paise, sale_ends_at, stock_qty, is_active, sort_order), product_images(id, storage_path, sort_order)";

export const IMAGE_BUCKET = "product-images";

export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function mainImage(p: Pick<Product, "product_images">): string | null {
  const first = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
  return imageUrl(first?.storage_path);
}

/** Price the customer pays now (sale price while it is valid). Display only — the DB decides at checkout. */
export function effectivePrice(v: Variant, now = Date.now()): number {
  if (v.sale_price_paise != null && (!v.sale_ends_at || new Date(v.sale_ends_at).getTime() > now)) {
    return v.sale_price_paise;
  }
  return v.price_paise;
}

/** Strike-through price to show next to the selling price, if any. */
export function comparePrice(v: Variant): number | null {
  const pay = effectivePrice(v);
  const ref = v.sale_price_paise != null && pay === v.sale_price_paise ? Math.max(v.price_paise, v.mrp_paise ?? 0) : v.mrp_paise;
  return ref != null && ref > pay ? ref : null;
}

export function activeVariants(p: Pick<Product, "product_variants">): Variant[] {
  return [...(p.product_variants ?? [])]
    .filter((v) => v.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.price_paise - b.price_paise);
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
