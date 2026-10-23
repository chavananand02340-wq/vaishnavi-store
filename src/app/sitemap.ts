import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!site) return [];
  const entries: MetadataRoute.Sitemap = [{ url: site, changeFrequency: "daily", priority: 1 }];
  if (!url || !key) return entries;

  try {
    // Public data only, read with the anon key (no cookies needed here).
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from("categories").select("slug, updated_at").eq("is_active", true),
      supabase.from("products").select("id, updated_at").eq("is_active", true).limit(5000),
    ]);
    for (const c of cats ?? []) entries.push({ url: `${site}/c/${c.slug}`, lastModified: c.updated_at, changeFrequency: "daily", priority: 0.8 });
    for (const p of prods ?? []) entries.push({ url: `${site}/p/${p.id}`, lastModified: p.updated_at, changeFrequency: "weekly", priority: 0.6 });
  } catch {
    /* sitemap still works with the home page only */
  }
  return entries;
}
