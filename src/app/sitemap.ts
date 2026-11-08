import type { MetadataRoute } from "next";
import { publicEnv } from "@/config/env";
import { LEGAL_LINKS } from "@/config/site";
import { getSitemapRows } from "@/services/catalog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = publicEnv.siteUrl;
  if (!site) return [];
  const entries: MetadataRoute.Sitemap = [
    { url: site, changeFrequency: "daily", priority: 1 },
    { url: `${site}/categories`, changeFrequency: "daily", priority: 0.8 },
    ...LEGAL_LINKS.map((l) => ({ url: `${site}${l.href}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
  // If the database can't be reached the sitemap still lists the main pages.
  const { categories, products } = await getSitemapRows().catch(() => ({ categories: [], products: [] }));
  for (const c of categories) entries.push({ url: `${site}/c/${c.slug}`, lastModified: c.updated_at, changeFrequency: "daily", priority: 0.8 });
  for (const p of products) entries.push({ url: `${site}/p/${p.id}`, lastModified: p.updated_at, changeFrequency: "weekly", priority: 0.6 });
  return entries;
}
