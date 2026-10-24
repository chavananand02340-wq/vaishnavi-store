"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { formatPaise } from "@/lib/money";
import { PRODUCT_SELECT, effectivePrice, mainImage, type Category, type Product } from "@/lib/catalog";
import { useAsync, must } from "@/lib/useAsync";
import { refreshStorefront } from "@/components/admin/team";
import { Empty, ErrorBox, PageTitle, Spinner } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

type Filter = "" | "low" | "out" | "hidden" | "featured" | "nophoto";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "", label: "All" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Out of stock" },
  { key: "nophoto", label: "No photo" },
  { key: "hidden", label: "Hidden" },
  { key: "featured", label: "Favourites" },
];

function StockInput({ id, value, low, onSaved }: { id: string; value: number; low: boolean; onSaved: (v: number) => void }) {
  const toast = useToast();
  const [v, setV] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const dirty = v !== String(value);
  async function save() {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) return toast("Stock must be 0 or more", "error");
    setSaving(true);
    const { error } = await supabase().from("product_variants").update({ stock_qty: n }).eq("id", id);
    setSaving(false);
    if (error) return toast("Couldn't save stock", "error");
    onSaved(n);
    toast("Stock updated");
    void refreshStorefront();
  }
  return (
    <span className="flex items-center gap-1.5">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && dirty && save()}
        className={`h-10 w-16 rounded-lg border px-2 text-center text-[15px] font-bold ${low ? "border-rose-300 bg-rose-50 text-rose-800" : "border-line bg-white"}`}
        aria-label="Stock"
      />
      {dirty && (
        <button type="button" onClick={save} disabled={saving} className="h-10 rounded-lg bg-teal-600 px-3 text-[14px] font-bold text-white">
          {saving ? "…" : "Save"}
        </button>
      )}
    </span>
  );
}

function ProductsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const filter = (sp.get("filter") ?? "") as Filter;
  const cat = sp.get("cat") ?? "";
  const [q, setQ] = useState("");

  const { data, error, loading, reload, setData } = useAsync(async () => {
    const sb = supabase();
    const [p, c, s] = await Promise.all([
      sb.from("products").select(`${PRODUCT_SELECT}, search_keywords`).order("name").limit(3000),
      sb.from("categories").select("id, name, slug, sort_order, is_active, image_path").order("sort_order"),
      sb.from("store_settings").select("low_stock_threshold").eq("id", 1).single(),
    ]);
    return {
      products: must(p) as unknown as Product[],
      categories: must(c) as unknown as Category[],
      low: (s.data?.low_stock_threshold as number) ?? 5,
    };
  });

  const list = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.products.filter((p) => {
      const vs = p.product_variants.filter((v) => v.is_active);
      if (cat && p.category_id !== cat) return false;
      if (term && !`${p.name} ${p.search_keywords ?? ""}`.toLowerCase().includes(term)) return false;
      if (filter === "low") return vs.some((v) => v.stock_qty <= data.low);
      if (filter === "out") return vs.length > 0 && vs.every((v) => v.stock_qty === 0);
      if (filter === "hidden") return !p.is_active;
      if (filter === "featured") return p.is_featured;
      if (filter === "nophoto") return p.product_images.length === 0;
      return true;
    });
  }, [data, q, cat, filter]);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`/admin/products${p.size ? `?${p}` : ""}`);
  };

  const catName = new Map((data?.categories ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <PageTitle
        title="Products"
        hue="products"
        icon="box"
        action={
          <Link href="/admin/products/new" className="btn bg-teal-600 px-3 text-white">
            <Icon name="plus" className="size-5" strokeWidth={2.6} /> Add
          </Link>
        }
      />

      {data && data.categories.length === 0 && (
        <div className="mb-4 rounded-2xl bg-fuchsia-50 p-4 text-fuchsia-900 ring-1 ring-fuchsia-200">
          <p className="font-bold">Start with categories</p>
          <p className="text-[15px]">Products sit inside categories like “Atta, Rice & Dal”.</p>
          <Link href="/admin/categories" className="btn mt-3 bg-fuchsia-600 text-white">Add categories</Link>
        </div>
      )}

      <div className="relative mb-2">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input className="field pl-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your products" type="search" />
      </div>
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setParam("filter", f.key)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-bold ring-1 ${f.key === filter ? "bg-teal-600 text-white ring-teal-600" : "bg-white ring-line"}`}>
            {f.label}
          </button>
        ))}
      </div>
      {data && data.categories.length > 0 && (
        <select className="field mb-4 py-2.5" value={cat} onChange={(e) => setParam("cat", e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox text={error} retry={reload} />
      ) : list.length === 0 ? (
        <Empty
          icon="box"
          title={data?.products.length ? "No products match" : "No products yet"}
          text={data?.products.length ? "Clear the search or pick another filter." : "Add your first product. It takes a minute with a phone photo."}
          action={!data?.products.length && <Link href="/admin/products/new" className="btn bg-teal-600 text-white">Add product</Link>}
        />
      ) : (
        <>
          <p className="mb-2 text-[14px] text-muted">{list.length} products</p>
          <ul className="space-y-2">
            {list.map((p) => {
              const img = mainImage(p);
              const vs = [...p.product_variants].sort((a, b) => a.sort_order - b.sort_order);
              return (
                <li key={p.id} className="rounded-2xl bg-white p-3 ring-1 ring-line">
                  <Link href={`/admin/products/edit?id=${p.id}`} className="flex items-center gap-3">
                    <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-page">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {img ? <img src={img} alt="" className="size-full object-contain" loading="lazy" /> : <span className="flex size-full items-center justify-center text-teal-700"><Icon name="camera" /></span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{p.name}</span>
                      <span className="flex flex-wrap gap-1.5 text-[12.5px]">
                        <span className="text-muted">{catName.get(p.category_id) ?? ""}</span>
                        {!p.is_active && <span className="rounded bg-slate-200 px-1.5 font-bold text-slate-700">Hidden</span>}
                        {p.is_featured && <span className="rounded bg-haldi-100 px-1.5 font-bold text-haldi-700">Favourite</span>}
                        {!img && <span className="rounded bg-teal-50 px-1.5 font-bold text-teal-800">Add photo</span>}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-[13px] font-bold text-teal-800">
                      <Icon name="edit" className="size-4" /> Edit
                    </span>
                  </Link>
                  <div className="mt-2 space-y-1.5 border-t border-line pt-2">
                    {vs.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 text-[14px]">
                        <span className={`min-w-0 flex-1 truncate ${v.is_active ? "" : "text-muted line-through"}`}>{v.label}</span>
                        <span className="w-16 text-right font-bold">{formatPaise(effectivePrice(v))}</span>
                        <StockInput
                          id={v.id}
                          value={v.stock_qty}
                          low={v.stock_qty <= (data?.low ?? 5)}
                          onSaved={(n) =>
                            data &&
                            setData({
                              ...data,
                              products: data.products.map((x) => (x.id === p.id ? { ...x, product_variants: x.product_variants.map((y) => (y.id === v.id ? { ...y, stock_qty: n } : y)) } : x)),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ProductsInner />
    </Suspense>
  );
}
