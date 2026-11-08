"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createProduct, listCategories } from "@/services/admin/catalog";
import { EMPTY_VARIANT, detailsToRow, emptyDetails, parseVariant, type DetailsForm, type VariantForm } from "@/lib/product-form";
import { useAsync } from "@/hooks/useAsync";
import { useAction } from "@/hooks/useAction";
import { ProductDetailsForm } from "@/components/admin/ProductDetailsForm";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { Card, CardTitle, PageTitle, Spinner } from "@/components/admin/AdminUI";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

function NewProduct() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const { data: categories, loading } = useAsync(listCategories);
  const fresh = (): DetailsForm => emptyDetails(sp.get("cat") ?? "");
  const [d, setD] = useState<DetailsForm>(fresh);
  const [v, setV] = useState<VariantForm>(EMPTY_VARIANT);
  const [added, setAdded] = useState<string[]>([]);
  const { run, isBusy: saving } = useAction();

  async function save(andAnother: boolean) {
    const pv = parseVariant(v);
    if ("error" in pv) return toast(pv.error, "error");
    const name = d.name.trim();
    await run("save", () => createProduct(detailsToRow(d), pv.row), {
      refreshStore: true,
      onSuccess: (id) => {
        if (!andAnother) return router.replace(`/admin/products/edit?id=${id}&created=1`);
        toast(`Added ${name}`);
        setAdded((a) => [name, ...a].slice(0, 5));
        setD({ ...fresh(), category_id: d.category_id });
        setV(EMPTY_VARIANT);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    });
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
