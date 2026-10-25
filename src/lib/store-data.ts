import { cache } from "react";
import { publicSupabase } from "@/lib/supabase/public";
import { PRODUCT_SELECT, imageUrl, type Category, type Product } from "@/lib/catalog";
import { inStock, toCard, type CardProduct } from "@/lib/cards";

export type { CardProduct, CardVariant } from "@/lib/cards";
export { inStock, waLink } from "@/lib/cards";

export type PublicSettings = {
  store_name: string;
  tagline: string | null;
  address: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  whatsapp_number: string | null;
  instagram_url: string | null;
  maps_url: string | null;
  open_time: string;
  close_time: string;
  accepting_orders: boolean;
  closed_message: string | null;
  announcement: string | null;
  delivery_fee_paise: number;
  free_delivery_enabled: boolean;
  free_delivery_threshold_paise: number;
  min_order_paise: number | null;
  default_eta_minutes: number;
  cod_enabled: boolean;
  upi_enabled: boolean;
  sale_enabled: boolean;
  sale_title: string | null;
  sale_subtitle: string | null;
  sale_percent: number | null;
  sale_coupon_code: string | null;
  sale_image_path?: string | null;
  sale_link_url?: string | null;
  sale_theme: "festive" | "red" | "green" | "night";
  legal_name: string | null;
  gstin: string | null;
  fssai_number: string | null;
  support_email: string | null;
};

export const SETTINGS_SELECT =
  "store_name, tagline, address, phone_primary, phone_secondary, whatsapp_number, instagram_url, maps_url, open_time, close_time, accepting_orders, closed_message, announcement, delivery_fee_paise, free_delivery_enabled, free_delivery_threshold_paise, min_order_paise, default_eta_minutes, cod_enabled, upi_enabled, sale_enabled, sale_title, sale_subtitle, sale_percent, sale_coupon_code, sale_theme, sale_image_path, sale_link_url, legal_name, gstin, fssai_number, support_email";

export const getSettings = cache(async (): Promise<PublicSettings | null> => {
  const sb = publicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("store_settings").select(SETTINGS_SELECT).eq("id", 1).maybeSingle();
  if (error) {
    // A newer column may not exist yet (SQL part not run): fall back to all columns.
    const { data: all } = await sb.from("store_settings").select("*").eq("id", 1).maybeSingle();
    return (all as unknown as PublicSettings) ?? null;
  }
  return (data as unknown as PublicSettings) ?? null;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const sb = publicSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("categories")
    .select("id, name, slug, sort_order, is_active, image_path")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  return (data ?? []) as unknown as Category[];
});

/** Every sellable product (active, in an active category), in-stock first. */
export const getCatalog = cache(async (): Promise<CardProduct[]> => {
  const sb = publicSupabase();
  if (!sb) return [];
  const [cats, { data }] = await Promise.all([
    getCategories(),
    sb.from("products").select(PRODUCT_SELECT).eq("is_active", true).order("name").limit(2000),
  ]);
  const active = new Set(cats.map((c) => c.id));
  return ((data ?? []) as unknown as Product[])
    .filter((p) => active.has(p.category_id))
    .map(toCard)
    .filter((c): c is CardProduct => c !== null)
    .sort((a, b) => Number(inStock(b)) - Number(inStock(a)));
});

export const getProduct = cache(async (id: string): Promise<Product | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sb = publicSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  return (data as unknown as Product) ?? null;
});

export type Banner = { id: string; image: string; link: string | null; alt: string | null };

export const getBanners = cache(async (): Promise<Banner[]> => {
  const sb = publicSupabase();
  if (!sb) return [];
  const { data } = await sb.from("banners").select("id, image_path, link_url, alt_text").eq("is_active", true).order("sort_order").limit(8);
  return ((data ?? []) as { id: string; image_path: string; link_url: string | null; alt_text: string | null }[])
    .map((b) => ({ id: b.id, image: imageUrl(b.image_path) ?? "", link: b.link_url, alt: b.alt_text }))
    .filter((b) => b.image);
});
