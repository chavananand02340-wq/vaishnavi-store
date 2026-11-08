import { cache } from "react";
import { publicSupabase } from "@/services/supabase/public";
import { CATEGORY_SELECT, PRODUCT_SELECT, imageUrl, inStock, toCards } from "@/lib/catalog";
import { isUuid } from "@/lib/validation";
import type { Banner, CardProduct, Category, Product } from "@/types/catalog";
import type { PublicSettings } from "@/types/settings";

/**
 * Storefront reads used by server pages (cached per request with React `cache`,
 * and on the CDN by the page's `revalidate`). Public data only.
 *
 * Errors: the storefront should still render if the database hiccups, so these
 * log and return an empty value instead of throwing.
 */

const SETTINGS_SELECT =
  "store_name, tagline, address, phone_primary, phone_secondary, whatsapp_number, instagram_url, maps_url, open_time, close_time, accepting_orders, closed_message, announcement, delivery_fee_paise, free_delivery_enabled, free_delivery_threshold_paise, min_order_paise, default_eta_minutes, cod_enabled, upi_enabled, razorpay_enabled, sale_enabled, sale_title, sale_subtitle, sale_percent, sale_coupon_code, sale_theme, sale_image_path, sale_link_url, legal_name, gstin, fssai_number, support_email";

function logFail(what: string, error: unknown) {
  console.error(`[catalog] ${what} failed`, error);
}

export const getSettings = cache(async (): Promise<PublicSettings | null> => {
  const sb = publicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("store_settings").select(SETTINGS_SELECT).eq("id", 1).maybeSingle();
  if (!error) return (data as unknown as PublicSettings) ?? null;
  // A newer column may not exist yet (an SQL part not run): fall back to every column.
  const all = await sb.from("store_settings").select("*").eq("id", 1).maybeSingle();
  if (all.error) logFail("settings", all.error);
  return (all.data as unknown as PublicSettings) ?? null;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const sb = publicSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("categories").select(CATEGORY_SELECT).eq("is_active", true).order("sort_order").order("name");
  if (error) logFail("categories", error);
  return (data ?? []) as Category[];
});

/** Every sellable product (active, in an active category), in-stock first. */
export const getCatalog = cache(async (): Promise<CardProduct[]> => {
  const sb = publicSupabase();
  if (!sb) return [];
  const [cats, { data, error }] = await Promise.all([getCategories(), sb.from("products").select(PRODUCT_SELECT).eq("is_active", true).order("name").limit(2000)]);
  if (error) logFail("catalog", error);
  const active = new Set(cats.map((c) => c.id));
  return toCards(((data ?? []) as unknown as Product[]).filter((p) => active.has(p.category_id))).sort((a, b) => Number(inStock(b)) - Number(inStock(a)));
});

export const getProduct = cache(async (id: string): Promise<Product | null> => {
  if (!isUuid(id)) return null;
  const sb = publicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("products").select(PRODUCT_SELECT).eq("id", id).eq("is_active", true).maybeSingle();
  if (error) logFail("product", error);
  return (data as unknown as Product) ?? null;
});

export const getBanners = cache(async (): Promise<Banner[]> => {
  const sb = publicSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("banners").select("id, image_path, link_url, alt_text").eq("is_active", true).order("sort_order").limit(8);
  if (error) logFail("banners", error);
  return ((data ?? []) as { id: string; image_path: string; link_url: string | null; alt_text: string | null }[])
    .map((b) => ({ id: b.id, image: imageUrl(b.image_path) ?? "", link: b.link_url, alt: b.alt_text }))
    .filter((b) => b.image);
});

/** Slugs and ids with their last change, for sitemap.xml. */
export async function getSitemapRows(): Promise<{ categories: { slug: string; updated_at: string }[]; products: { id: string; updated_at: string }[] }> {
  const sb = publicSupabase();
  if (!sb) return { categories: [], products: [] };
  const [c, p] = await Promise.all([
    sb.from("categories").select("slug, updated_at").eq("is_active", true),
    sb.from("products").select("id, updated_at").eq("is_active", true).limit(5000),
  ]);
  if (c.error || p.error) logFail("sitemap", c.error ?? p.error);
  return { categories: (c.data ?? []) as { slug: string; updated_at: string }[], products: (p.data ?? []) as { id: string; updated_at: string }[] };
}
