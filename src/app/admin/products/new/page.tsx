"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import type { Category } from "@/lib/catalog";
import { EMPTY_VARIANT, parseVariant, type VariantForm } from "@/lib/catalog-admin";
import { useAsync, must } from "@/lib/useAsync";
import { refreshStorefront } from "@/components/admin/team";
import { ProductDetailsForm, type DetailsForm } from "@/components/admin/ProductDetailsForm";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { Card, CardTitle, PageTitle, Spinner } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

function NewProduct() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const { data: categories, loading } = useAsync(async () => {
    const r = await supabase().from("categories").select("id, name, slug, sort_order, is_active, image_path").order("sort_order");
    return must(r) as unknown as Category[];
  });
  const fresh = (): DetailsForm => ({ name: "", name_local: "", category_id: sp.get("cat") ?? "", search_keywords: "", description: "", is_active: true, is_featured: false });
  const [d, setD] = useState<DetailsForm>(fresh);
  const [v, setV] = useState<VariantForm>(EMPTY_VARIANT);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<string[]>([]);

  async function save(andAnother: boolean) {
    if (d.name.trim().length < 2) return toast("Write the product name.", "error");
    if (!d.category_id) return toast("Choose a category.", "error");
    const pv = parseVariant(v);
    if ("error" in pv) return toast(pv.error, "error");
    setSaving(true);
    const sb = supabase();
    const ins = await sb
      .from("products")
      .insert({
        name: d.name.trim(),
        name_local: d.name_local.trim() || null,
        category_id: d.category_id,
        search_keywords: d.search_keywords.trim() || null,
        description: d.description.trim() || null,
        is_active: d.is_active,
        is_featured: d.is_featured,
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      setSaving(false);
      return toast("Couldn't save the product. Check your internet.", "error");
    }
    const vr = await sb.from("product_variants").insert({ ...pv.row, product_id: ins.data.id, sort_order: 0 });
    setSaving(false);
    if (vr.error) {
      await sb.from("products").delete().eq("id", ins.data.id);
      return toast("Couldn't save the price. Please try again.", "error");
    }
    void refreshStorefront();
    if (andAnother) {
      toast(`Added ${d.name.trim()}`);
      setAdded((a) => [d.name.trim(), ...a].slice(0, 5));
      setD({ ...fresh(), category_id: d.category_id });
      setV(EMPTY_VARIANT);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.replace(`/admin/products/edit?id=${ins.data.id}&created=1`);
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageTitle title="Add product" hue="products" icon="plus" action={<Link href="/admin/products" className="text-[14px] font-bold text-teal-700">All products</Link>} />
      {added.length > 0 && (
        <p className="rounded-xl bg-teal-50 px-4 py-3 text-[14px] text-teal-900 ring-1 ring-teal-200">
          Just added: <b>{added.join(", ")}</b>
        </p>
      )}
      {categories && categories.length === 0 ? (
        <Card>
          <p className="font-bold">Add a category first</p>
          <Link href="/admin/categories" className="btn mt-3 bg-fuchsia-600 text-white">Go to categories</Link>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>About the product</CardTitle>
            <ProductDetailsForm v={d} onChange={setD} categories={categories ?? []} />
          </Card>
          <Card>
            <CardTitle hint="Add more sizes (500 g, 5 kg) and photos on the next screen.">First size and price</CardTitle>
            <VariantEditor v={v} onChange={setV} idp="new" />
          </Card>
        </div>
      )}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 grid grid-cols-2 gap-2 rounded-2xl bg-white/95 p-2 ring-1 ring-line backdrop-blur lg:bottom-4">
        <button type="button" className="btn-plain" disabled={saving} onClick={() => save(true)}>
          Save, add another
        </button>
        <button type="button" className="btn bg-teal-600 text-white" disabled={saving} onClick={() => save(false)}>
          <Icon name="camera" className="size-5" /> {saving ? "Saving…" : "Save, add photos"}
        </button>
      </div>
    </div>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewProduct />
    </Suspense>
  );
}
