import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { ProductFields } from "@/components/admin/ProductFields";
import { VariantFields } from "@/components/admin/VariantFields";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { imageUrl, type Category, type Product } from "@/lib/catalog";
import {
  addVariant,
  deleteProduct,
  deleteProductImage,
  deleteVariant,
  duplicateProduct,
  makeMainImage,
  updateProduct,
  updateVariant,
} from "../../catalog-actions";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string; duplicated?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: prod }, { data: cats }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, description, search_keywords, category_id, is_active, is_featured, product_variants(id, label, price_paise, mrp_paise, sale_price_paise, sale_ends_at, stock_qty, is_active, sort_order), product_images(id, storage_path, sort_order)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("categories").select("id, name, slug, sort_order, is_active, image_path").order("sort_order"),
  ]);
  if (!prod) notFound();
  const p = prod as unknown as Product;
  const categories = (cats ?? []) as unknown as Category[];
  const variants = [...p.product_variants].sort((a, b) => a.sort_order - b.sort_order);
  const images = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order);

  const ok = sp.created
    ? "Product added. Add photos and more sizes below."
    : sp.duplicated
      ? "Copy created (hidden, stock 0). Change the name and sizes, then show it."
      : sp.saved
        ? "Saved."
        : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/admin/products" className="text-sm text-brand-700">‹ All products</Link>
        <Link href={`/p/${p.id}`} className="text-sm text-brand-700" target="_blank">View on site ↗</Link>
      </div>
      <Notice ok={ok} error={sp.error ?? null} />

      {/* Photos */}
      <section className="card space-y-3">
        <h2 className="font-semibold">Photos</h2>
        {images.length === 0 && <p className="text-sm text-neutral-600">No photo yet. A clear photo on a plain background sells best.</p>}
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={img.id} className="space-y-1">
              <div className="aspect-square overflow-hidden rounded-lg bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(img.storage_path) ?? ""} alt="" className="size-full object-cover" />
              </div>
              {i === 0 ? (
                <p className="text-center text-xs font-medium text-brand-700">Main photo</p>
              ) : (
                <form action={makeMainImage}>
                  <input type="hidden" name="id" value={img.id} />
                  <input type="hidden" name="product_id" value={p.id} />
                  <button className="w-full text-xs text-brand-700 underline" type="submit">Make main</button>
                </form>
              )}
              <form action={deleteProductImage}>
                <input type="hidden" name="id" value={img.id} />
                <input type="hidden" name="product_id" value={p.id} />
                <button className="w-full text-xs text-red-700 underline" type="submit">Remove</button>
              </form>
            </div>
          ))}
        </div>
        <ImageUploader productId={p.id} disabled={images.length >= 6} />
      </section>

      {/* Details */}
      <form action={updateProduct} className="card space-y-4">
        <h2 className="font-semibold">Details</h2>
        <input type="hidden" name="id" value={p.id} />
        <ProductFields p={p} categories={categories} />
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={p.is_active} className="size-5 accent-brand-600" />
          Show on website
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="is_featured" defaultChecked={p.is_featured} className="size-5 accent-brand-600" />
          Show in “Popular” on the home page
        </label>
        <SubmitButton className="btn-primary w-full">Save details</SubmitButton>
      </form>

      {/* Sizes */}
      <section className="space-y-3">
        <h2 className="font-semibold">Sizes, prices & stock</h2>
        {variants.map((v) => (
          <div key={v.id} className="card space-y-3">
            <form action={updateVariant} className="space-y-3">
              <input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="product_id" value={p.id} />
              <VariantFields v={v} idPrefix={v.id} />
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={v.is_active} className="size-5 accent-brand-600" />
                Sell this size
              </label>
              <SubmitButton className="btn-ghost w-full">Save size</SubmitButton>
            </form>
            {variants.length > 1 && (
              <form action={deleteVariant}>
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="product_id" value={p.id} />
                <SubmitButton className="btn-danger w-full" pendingText="Deleting…">Delete size</SubmitButton>
              </form>
            )}
          </div>
        ))}

        <details className="card">
          <summary className="cursor-pointer font-medium text-brand-700">+ Add another size</summary>
          <form action={addVariant} className="mt-3 space-y-3">
            <input type="hidden" name="product_id" value={p.id} />
            <VariantFields idPrefix="add" />
            <SubmitButton className="btn-primary w-full" pendingText="Adding…">Add size</SubmitButton>
          </form>
        </details>
      </section>

      {/* Other actions */}
      <section className="card space-y-3">
        <form action={duplicateProduct}>
          <input type="hidden" name="id" value={p.id} />
          <SubmitButton className="btn-ghost w-full" pendingText="Copying…">Duplicate (for a similar product)</SubmitButton>
        </form>
        <details>
          <summary className="cursor-pointer text-sm text-red-700">Delete product</summary>
          <form action={deleteProduct} className="mt-3 space-y-2">
            <input type="hidden" name="id" value={p.id} />
            <p className="hint">Usually it is better to untick “Show on website”. Old orders are not affected either way.</p>
            <input className="field" name="confirm" placeholder="Type DELETE" autoComplete="off" />
            <SubmitButton className="btn-danger w-full" pendingText="Deleting…">Delete permanently</SubmitButton>
          </form>
        </details>
      </section>
    </div>
  );
}
