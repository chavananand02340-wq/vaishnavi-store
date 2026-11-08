"use client";

import { supabase } from "@/services/supabase/browser";
import { PRODUCT_SELECT, toCards } from "@/lib/catalog";
import type { CardProduct, Product } from "@/types/catalog";

const searchCache = new Map<string, Promise<CardProduct[]>>();

/** Letters, numbers and spaces only (safe inside a PostgREST filter). */
export function cleanTerm(t: string) {
  return t.normalize("NFC").replace(/[^\p{L}\p{N}\p{M} ]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

/**
 * Fast product search: one quick "contains" query first (name, Hindi/Marathi name, keywords);
 * only if that finds very little do we also run the spelling-tolerant search.
 * Results are cached for the visit; a failed search is not cached.
 */
export function searchProducts(raw: string, limit = 40): Promise<CardProduct[]> {
  const term = cleanTerm(raw).toLowerCase();
  if (term.length < 2) return Promise.resolve([]);
  const key = `${term}|${limit}`;
  const hit = searchCache.get(key);
  if (hit) return hit;
  const job = (async () => {
    const sb = supabase();
    const like = `%${term}%`;
    const { data, error } = await sb
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .or(`name.ilike.${like},name_local.ilike.${like},search_keywords.ilike.${like}`)
      .order("is_featured", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    let rows = (data ?? []) as unknown as Product[];
    if (rows.length < 3) {
      const { data: ids } = await sb.rpc("search_products", { p_q: term, p_limit: limit });
      const list = ((ids ?? []) as string[]).filter((id) => !rows.some((r) => r.id === id));
      if (list.length) rows = rows.concat(await productsInOrder(list));
    }
    // Names that start with the word come first.
    rows.sort((a, b) => Number(!a.name.toLowerCase().startsWith(term)) - Number(!b.name.toLowerCase().startsWith(term)));
    return toCards(rows);
  })();
  searchCache.set(key, job);
  job.catch(() => searchCache.delete(key));
  return job;
}

/** Active products by id, in the order given (favourites, search fallback). */
async function productsInOrder(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase().from("products").select(PRODUCT_SELECT).in("id", ids).eq("is_active", true);
  if (error) throw new Error(error.message);
  const order = new Map(ids.map((id, i) => [id, i]));
  return ((data ?? []) as unknown as Product[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getProductCards(ids: string[]): Promise<CardProduct[]> {
  return toCards(await productsInOrder(ids));
}
