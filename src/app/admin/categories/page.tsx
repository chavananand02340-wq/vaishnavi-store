import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import type { Category } from "@/lib/catalog";
import { createCategory, deleteCategory, updateCategory } from "../catalog-actions";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; removed?: string; error?: string }>;
}) {
  const { saved, removed, error } = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: counts }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, sort_order, is_active, image_path").order("sort_order").order("name"),
    supabase.from("products").select("category_id"),
  ]);
  const cats = (data ?? []) as unknown as Category[];
  const countBy = new Map<string, number>();
  for (const r of (counts ?? []) as unknown as { category_id: string }[]) countBy.set(r.category_id, (countBy.get(r.category_id) ?? 0) + 1);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Categories</h1>
      <Notice ok={saved ? `Saved "${saved}".` : removed ? "Category deleted." : null} error={error ?? null} />

      <form action={createCategory} className="card flex items-end gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="new-cat">New category</label>
          <input className="field" id="new-cat" name="name" placeholder="e.g. Atta, Rice & Dal" maxLength={60} required />
        </div>
        <SubmitButton pendingText="Adding…">Add</SubmitButton>
      </form>

      <p className="hint">Lower position numbers show first on the website.</p>
      <div className="space-y-3">
        {cats.length === 0 && <p className="card text-sm text-neutral-600">No categories yet. Add your first one above.</p>}
        {cats.map((c) => (
          <div key={c.id} className="card">
            <form action={updateCategory} className="space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <div>
                  <label className="label" htmlFor={`n-${c.id}`}>Name · {countBy.get(c.id) ?? 0} products</label>
                  <input className="field" id={`n-${c.id}`} name="name" defaultValue={c.name} maxLength={60} required />
                </div>
                <div>
                  <label className="label" htmlFor={`s-${c.id}`}>Position</label>
                  <input className="field" id={`s-${c.id}`} name="sort_order" type="number" inputMode="numeric" defaultValue={c.sort_order} />
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={c.is_active} className="size-5 accent-brand-600" />
                Show on website
              </label>
              <SubmitButton className="btn-ghost w-full">Save</SubmitButton>
            </form>
            {!countBy.get(c.id) && (
              <form action={deleteCategory} className="mt-2">
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton className="btn-danger w-full" pendingText="Deleting…">Delete empty category</SubmitButton>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
