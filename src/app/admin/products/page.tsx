import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { formatPaise } from "@/lib/money";
import { PRODUCT_SELECT, effectivePrice, mainImage, type Category, type Product } from "@/lib/catalog";
import { quickStock } from "../catalog-actions";

const PAGE = 30;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; filter?: string; page?: string; saved?: string; removed?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  const [{ data: cats }, { data: settings }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, sort_order, is_active, image_path").order("sort_order"),
    supabase.from("store_settings").select("low_stock_threshold").eq("id", 1).single(),
  ]);
  const categories = (cats ?? []) as unknown as Category[];
  const low = settings?.low_stock_threshold ?? 5;

  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    .order("name")
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) {
    const safe = q.replace(/[%_,()]/g, " ");
    query = query.or(`name.ilike.%${safe}%,search_keywords.ilike.%${safe}%`);
  }
  if (sp.cat && /^[0-9a-f-]{36}$/i.test(sp.cat)) query = query.eq("category_id", sp.cat);
  if (sp.filter === "hidden") query = query.eq("is_active", false);
  if (sp.filter === "featured") query = query.eq("is_featured", true);

  const { data, count } = await query;
  let products = (data ?? []) as unknown as Product[];
  if (sp.filter === "low") {
    products = products.filter((p) => p.product_variants.some((v) => v.is_active && v.stock_qty <= low));
  }
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const returnTo = `/admin/products?${new URLSearchParams(
    Object.entries({ q, cat: sp.cat ?? "", filter: sp.filter ?? "", page: String(page) }).filter(([, v]) => v),
  ).toString()}`;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Products {count != null && <span className="text-neutral-500">({count})</span>}</h1>
        <Link className="btn-primary" href="/admin/products/new">+ Add product</Link>
      </div>
      <Notice ok={sp.saved ? "Saved." : sp.removed ? "Product deleted." : null} error={sp.error ?? null} />

      {categories.length === 0 && (
        <p className="card text-sm">
          First <Link className="font-medium text-brand-700 underline" href="/admin/categories">add a category</Link>, then add products.
        </p>
      )}

      <form className="card grid grid-cols-2 gap-2 sm:grid-cols-4" action="/admin/products">
        <input className="field col-span-2" name="q" defaultValue={q} placeholder="Search products" />
        <select className="field" name="cat" defaultValue={sp.cat ?? ""}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="field" name="filter" defaultValue={sp.filter ?? ""}>
          <option value="">All</option>
          <option value="low">Low stock (≤{low}, this page)</option>
          <option value="hidden">Hidden</option>
          <option value="featured">Featured</option>
        </select>
        <button className="btn-ghost col-span-2 sm:col-span-4" type="submit">Filter</button>
      </form>

      <div className="space-y-3">
        {products.length === 0 && <p className="card text-sm text-neutral-600">No products found.</p>}
        {products.map((p) => {
          const img = mainImage(p);
          const variants = [...p.product_variants].sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div key={p.id} className="card space-y-3">
              <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  {img ? <img src={img} alt="" className="size-full object-cover" loading="lazy" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-neutral-500">
                    {catName.get(p.category_id) ?? "—"}
                    {!p.is_active && <span className="ml-2 rounded bg-neutral-200 px-1.5 text-neutral-700">Hidden</span>}
                    {p.is_featured && <span className="ml-2 rounded bg-amber-100 px-1.5 text-amber-800">Featured</span>}
                    {!img && <span className="ml-2 text-amber-700">No photo</span>}
                  </p>
                </div>
                <span className="text-sm text-brand-700">Edit ›</span>
              </Link>
              {variants.map((v) => (
                <form key={v.id} action={quickStock} className="flex items-center gap-2 text-sm">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <span className="w-24 shrink-0 truncate">{v.label}</span>
                  <span className="w-16 shrink-0 font-medium">{formatPaise(effectivePrice(v))}</span>
                  <input
                    className={`field w-20 py-1.5 ${v.stock_qty <= low ? "border-amber-400 bg-amber-50" : ""}`}
                    name="stock"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    defaultValue={v.stock_qty}
                    aria-label={`Stock for ${p.name} ${v.label}`}
                  />
                  <SubmitButton className="btn-ghost min-h-9 px-3" pendingText="…">Save</SubmitButton>
                </form>
              ))}
            </div>
          );
        })}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link className="btn-ghost" href={returnTo.replace(/page=\d+/, `page=${page - 1}`)}>‹ Previous</Link>
          ) : <span />}
          <span>Page {page} of {pages}</span>
          {page < pages ? (
            <Link className="btn-ghost" href={returnTo.replace(/page=\d+/, `page=${page + 1}`)}>Next ›</Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
