import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { ProductFields } from "@/components/admin/ProductFields";
import { VariantFields } from "@/components/admin/VariantFields";
import type { Category } from "@/lib/catalog";
import { createProduct } from "../../catalog-actions";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; category?: string; error?: string }>;
}) {
  const { saved, category, error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name, slug, sort_order, is_active, image_path").order("sort_order");
  const categories = (data ?? []) as unknown as Category[];

  if (categories.length === 0) {
    return (
      <p className="card text-sm">
        Add a <Link className="font-medium text-brand-700 underline" href="/admin/categories">category</Link> first.
      </p>
    );
  }

  return (
    <form action={createProduct} className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Add product</h1>
        <Link href="/admin/products" className="text-sm text-brand-700">All products</Link>
      </div>
      <Notice ok={saved ? `"${saved}" added. Next one:` : null} error={error ?? null} />

      <section className="card">
        <ProductFields categories={categories} defaultCategory={category} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">First size & price</h2>
        <VariantFields idPrefix="new" />
        <p className="hint">More sizes (500 g, 5 kg…) and photos can be added on the next screen.</p>
      </section>

      <section className="card space-y-3 text-sm">
        <label className="flex items-center gap-3">
          <input type="checkbox" name="is_featured" className="size-5 accent-brand-600" />
          Show in “Popular” on the home page
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="is_hidden" className="size-5 accent-brand-600" />
          Keep hidden for now
        </label>
      </section>

      <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
        <button className="btn-ghost" type="submit" name="next" value="another">Save & add another</button>
        <SubmitButton>Save & add photos</SubmitButton>
      </div>
    </form>
  );
}
