"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  addVariant,
  deleteProduct,
  deleteVariant,
  duplicateProduct,
  getProductForEdit,
  removeProductPhoto,
  setMainPhoto,
  updateProduct,
  updateVariant,
} from "@/services/admin/catalog";
import { refreshStorefront } from "@/services/admin/auth";
import { imageUrl } from "@/lib/catalog";
import { EMPTY_VARIANT, detailsFromProduct, detailsToRow, parseVariant, variantToForm, type DetailsForm, type VariantForm } from "@/lib/product-form";
import { isUuid } from "@/lib/validation";
import { useAsync } from "@/hooks/useAsync";
import { useAction } from "@/hooks/useAction";
import { ProductDetailsForm } from "@/components/admin/ProductDetailsForm";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Card, CardTitle, Empty, ErrorBox, Spinner, Switch } from "@/components/admin/AdminUI";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { Variant } from "@/types/catalog";

function SizeCard({ v, productId, canDelete, onChanged }: { v: Variant; productId: string; canDelete: boolean; onChanged: () => void }) {
  const toast = useToast();
  const { run, isBusy: busy } = useAction();
  const [f, setF] = useState<VariantForm>(variantToForm(v));
  useEffect(() => setF(variantToForm(v)), [v]);

  async function save() {
    const pv = parseVariant(f);
    if ("error" in pv) return toast(pv.error, "error");
    await run("save", () => updateVariant(productId, v.id, pv.row), { success: `Saved ${pv.row.label}`, refreshStore: true, onSuccess: onChanged });
  }
  async function remove() {
    if (!window.confirm(`Delete size ${v.label}? Old orders are not affected.`)) return;
    await run("remove", () => deleteVariant(v), { success: "Size deleted", refreshStore: true, onSuccess: onChanged });
  }

  return (
    <Card className={f.active ? "" : "opacity-80"}>
      <VariantEditor v={f} onChange={setF} idp={v.id} />
      <div className="mt-3">
        <Switch checked={f.active} onChange={(x) => setF({ ...f, active: x })} label="Sell this size" />
      </div>
      <div className="mt-3 flex gap-2">
        {canDelete && (
          <button type="button" onClick={remove} disabled={busy} className="btn-danger px-3" aria-label={`Delete ${v.label}`}>
            <Icon name="trash" />
          </button>
        )}
        <button type="button" onClick={save} disabled={busy} className="btn flex-1 bg-teal-600 text-white">
          {busy ? "Saving…" : "Save size"}
        </button>
      </div>
    </Card>
  );
}

function Edit() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const id = sp.get("id") ?? "";
  const created = sp.get("created") === "1";
  const valid = isUuid(id);
  const [d, setD] = useState<DetailsForm | null>(null);
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState<VariantForm>(EMPTY_VARIANT);
  const { run, busy } = useAction();

  const { data, error, loading, reload } = useAsync(async () => (valid ? getProductForEdit(id) : null), [id]);

  const [dFor, setDFor] = useState<string | null>(null);
  useEffect(() => {
    const p = data?.product;
    if (p && p.id === id && p.id !== dFor) {
      setD(detailsFromProduct(p));
      setDFor(p.id);
    }
  }, [data, dFor, id]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} retry={reload} />;
  const p = data?.product;
  if (!p && !loading) return <Empty icon="box" title="Product not found" action={<Link href="/admin/products" className="btn-plain">All products</Link>} />;
  if (!p || !d || p.id !== id || dFor !== id) return <Spinner />;

  const variants = [...p.product_variants].sort((a, b) => a.sort_order - b.sort_order);
  const images = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order);

  const product = p;
  const after = { refreshStore: true, onSuccess: reload };

  const saveDetails = () => d && run("details", () => updateProduct(id, detailsToRow(d)), { success: "Details saved", ...after });

  async function addSize() {
    const pv = parseVariant(nv);
    if ("error" in pv) return toast(pv.error, "error");
    await run("add", () => addVariant(id, pv.row, variants.length * 10), {
      success: `Added ${pv.row.label}`,
      ...after,
      onSuccess: () => {
        setNv(EMPTY_VARIANT);
        setAdding(false);
        reload();
      },
    });
  }

  const setMain = (imgId: string) => run("img", () => setMainPhoto(images, imgId), after);
  const removeImage = (imgId: string, path: string) => run("img", () => removeProductPhoto({ id: imgId, storage_path: path }), { success: "Photo removed", ...after });

  const duplicate = () =>
    run("dup", () => duplicateProduct(product), {
      success: "Copy made. It's hidden with stock 0 until you edit it.",
      onSuccess: (newId) => router.replace(`/admin/products/edit?id=${newId}`),
    });

  async function del() {
    if (!window.confirm(`Delete "${product.name}" permanently? Old orders keep their details. Hiding it is usually better.`)) return;
    await run("del", () => deleteProduct(product), { success: "Product deleted", refreshStore: true, onSuccess: () => router.replace("/admin/products") });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/admin/products" className="inline-flex items-center gap-1 text-[15px] font-bold text-teal-700">
          <Icon name="left" className="size-4" strokeWidth={2.6} /> Products
        </Link>
        <Link href={`/p/${p.id}`} target="_blank" className="text-[14px] font-bold text-teal-700 underline">See on website</Link>
      </div>
      <h1 className="font-display text-[24px] font-bold leading-tight">{p.name}</h1>
      {created && <p className="rounded-xl bg-teal-50 px-4 py-3 text-[15px] font-semibold text-teal-900 ring-1 ring-teal-200">Saved. Now add a photo, and any other sizes.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardTitle hint="The first photo is shown in the shop. Use a plain background.">Photos</CardTitle>
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div key={img.id} className="space-y-1">
                  <div className={`aspect-square overflow-hidden rounded-xl bg-page ${i === 0 ? "ring-2 ring-teal-600" : "ring-1 ring-line"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(img.storage_path) ?? ""} alt="" className="size-full object-contain" />
                  </div>
                  <div className="flex gap-1">
                    {i === 0 ? (
                      <span className="flex-1 text-center text-[12px] font-bold text-teal-700">Main photo</span>
                    ) : (
                      <button type="button" disabled={!!busy} onClick={() => setMain(img.id!)} className="flex-1 rounded-md bg-teal-50 py-1 text-[12px] font-bold text-teal-800">Make main</button>
                    )}
                    <button type="button" disabled={!!busy} onClick={() => removeImage(img.id!, img.storage_path)} className="rounded-md bg-rose-50 px-2 py-1 text-rose-700" aria-label="Remove photo">
                      <Icon name="trash" className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              <ImageUploader productId={p.id} count={images.length} onDone={() => { void refreshStorefront(); reload(); }} />
            </div>
          </Card>

          <Card>
            <CardTitle>About the product</CardTitle>
            <ProductDetailsForm v={d} onChange={setD} categories={data?.categories ?? []} />
            <button type="button" onClick={saveDetails} disabled={busy === "details"} className="btn mt-4 w-full bg-teal-600 text-white">
              {busy === "details" ? "Saving…" : "Save details"}
            </button>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-[17px] font-bold">Sizes, prices and stock</h2>
          {variants.map((v) => (
            <SizeCard key={v.id} v={v} productId={p.id} canDelete={variants.length > 1} onChanged={reload} />
          ))}
          {adding ? (
            <Card>
              <CardTitle>New size</CardTitle>
              <VariantEditor v={nv} onChange={setNv} idp="add" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn-plain" onClick={() => setAdding(false)}>Cancel</button>
                <button type="button" className="btn bg-teal-600 text-white" disabled={busy === "add"} onClick={addSize}>{busy === "add" ? "Adding…" : "Add size"}</button>
              </div>
            </Card>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 py-4 text-[15px] font-bold text-teal-800">
              <Icon name="plus" className="size-5" strokeWidth={2.6} /> Add another size
            </button>
          )}

          <Card>
            <CardTitle>More</CardTitle>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={duplicate} disabled={!!busy} className="btn-plain">
                <Icon name="copy" /> Duplicate
              </button>
              <button type="button" onClick={del} disabled={!!busy} className="btn-danger">
                <Icon name="trash" /> Delete
              </button>
            </div>
            <p className="hint mt-2">Duplicate is handy for a similar item, like another brand of the same atta.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function EditProductPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Edit />
    </Suspense>
  );
}
