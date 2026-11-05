"use client";

import { supabase } from "@/lib/supabase/browser";
import { PRODUCT_SELECT, type Product } from "@/lib/catalog";
import { toCard, type CardProduct } from "@/lib/cards";

const cache = new Map<string, Promise<CardProduct[]>>();

/** Letters, numbers and spaces only (safe inside a PostgREST filter). */
export function cleanTerm(t: string) {
  return t.normalize("NFC").replace(/[^\p{L}\p{N}\p{M} ]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

/**
 * Fast product search: one quick "contains" query first (name, Hindi/Marathi name, keywords);
 * only if that finds very little do we also run the spelling-tolerant search.
 */
export function searchProducts(raw: string, limit = 40): Promise<CardProduct[]> {
  const term = cleanTerm(raw).toLowerCase();
  if (term.length < 2) return Promise.resolve([]);
  const key = `${term}|${limit}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = (async () => {
    const sb = supabase();
    const like = `%${term}%`;
    const { data } = await sb
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .or(`name.ilike.${like},name_local.ilike.${like},search_keywords.ilike.${like}`)
      .order("is_featured", { ascending: false })
      .limit(limit);
    let rows = (data ?? []) as unknown as Product[];
    if (rows.length < 3) {
      const { data: ids } = await sb.rpc("search_products", { p_q: term, p_limit: limit });
      const list = ((ids ?? []) as string[]).filter((id) => !rows.some((r) => r.id === id));
      if (list.length) {
        const { data: more } = await sb.from("products").select(PRODUCT_SELECT).in("id", list);
        const order = new Map(list.map((id, i) => [id, i]));
        rows = rows.concat(((more ?? []) as unknown as Product[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
      }
    }
    // Names that start with the word first.
    rows.sort((a, b) => Number(!a.name.toLowerCase().startsWith(term)) - Number(!b.name.toLowerCase().startsWith(term)));
    return rows.map(toCard).filter((c): c is CardProduct => c !== null);
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}
