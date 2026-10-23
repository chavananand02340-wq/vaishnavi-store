import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { PRODUCT_SELECT, activeVariants, effectivePrice, comparePrice, mainImage, type Category, type Product } from "@/lib/catalog";

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
};

const SETTINGS_SELECT =
  "store_name, tagline, address, phone_primary, phone_secondary, whatsapp_number, instagram_url, maps_url, open_time, close_time, accepting_orders, closed_message, announcement, delivery_fee_paise, free_delivery_enabled, free_delivery_threshold_paise, min_order_paise, default_eta_minutes, cod_enabled, upi_enabled";

export const getSettings = cache(async (): Promise<PublicSettings | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("store_settings").select(SETTINGS_SELECT).eq("id", 1).maybeSingle();
  return (data as unknown as PublicSettings) ?? null;
});

export const getStoreOpen = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("store_is_open");
  return data === true;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order, is_active, image_path")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  return (data ?? []) as unknown as Category[];
});

/** Plain, serialisable product shape for client components. */
export type CardVariant = {
  id: string;
  label: string;
  price: number;
  compare: number | null;
  stock: number;
};
export type CardProduct = {
  id: string;
  name: string;
  image: string | null;
  variants: CardVariant[];
};

export function toCard(p: Product): CardProduct | null {
  const variants = activeVariants(p).map((v) => ({
    id: v.id,
    label: v.label,
    price: effectivePrice(v),
    compare: comparePrice(v),
    stock: v.stock_qty,
  }));
  if (variants.length === 0) return null;
  return { id: p.id, name: p.name, image: mainImage(p), variants };
}

function cards(rows: unknown): CardProduct[] {
  return ((rows ?? []) as Product[])
    .map(toCard)
    .filter((c): c is CardProduct => c !== null)
    // In-stock items first.
    .sort((a, b) => Number(b.variants.some((v) => v.stock > 0)) - Number(a.variants.some((v) => v.stock > 0)));
}

export async function getFeatured(limit = 12): Promise<CardProduct[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  const activeCats = new Set((await getCategories()).map((c) => c.id));
  return cards(((data ?? []) as unknown as Product[]).filter((p) => activeCats.has(p.category_id)));
}

export async function getCategoryProducts(categoryId: string, limit = 200): Promise<CardProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .eq("category_id", categoryId)
    .order("name")
    .limit(limit);
  return cards(data);
}

export async function searchProducts(q: string): Promise<CardProduct[]> {
  const term = q.trim().slice(0, 60);
  if (term.length < 2 || !isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data: ids } = await supabase.rpc("search_products", { p_q: term, p_limit: 40 });
  const list = (ids ?? []) as string[];
  if (list.length === 0) return [];
  const { data } = await supabase.from("products").select(PRODUCT_SELECT).in("id", list);
  const order = new Map(list.map((id, i) => [id, i]));
  return ((data ?? []) as unknown as Product[])
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map(toCard)
    .filter((c): c is CardProduct => c !== null);
}

export async function getProduct(id: string): Promise<(Product & { search_keywords?: string | null }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id).eq("is_active", true).maybeSingle();
  return (data as unknown as Product) ?? null;
}

export function whatsappLink(number: string | null | undefined, text: string): string | null {
  if (!number) return null;
  return `https://wa.me/91${number}?text=${encodeURIComponent(text)}`;
}

export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${suffix}` : `${hh} ${suffix}`;
}
