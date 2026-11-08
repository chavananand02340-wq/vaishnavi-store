"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { addCategory, deleteCategory, listCategoriesWithCounts, saveOrder, setCategoryPhoto, swapped, updateCategory } from "@/services/admin/catalog";
import { imageUrl } from "@/lib/catalog";
import { useAsync } from "@/hooks/useAsync";
import { useAction } from "@/hooks/useAction";
import { Card, Empty, ErrorBox, PageTitle, Spinner, Switch } from "@/components/admin/AdminUI";
import { Icon } from "@/components/ui/Icon";
import type { Category } from "@/types/catalog";

const STARTERS = ["Atta, Rice & Dal", "Oil & Ghee", "Masala & Spices", "Snacks & Biscuits", "Tea, Coffee & Drinks", "Dairy & Breakfast", "Personal Care", "Cleaning & Household"];

function CategoryPhoto({ c, onChanged }: { c: Category; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const { run, isBusy: busy } = useAction();
  const url = imageUrl(c.image_path);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    await run("photo", () => setCategoryPhoto(c, file), { success: "Category photo saved", failure: "Upload failed", refreshStore: true, onSuccess: onChanged });
    if (input.current) input.current.value = "";
  }

  return (
    <>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200"
        aria-label={url ? `Change photo for ${c.name}` : `Add photo for ${c.name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" className="size-full object-contain" /> : <Icon name="camera" className="mx-auto size-6" />}
        {busy && <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-[11px] font-bold">…</span>}
      </button>
    </>
  );
}

export default function CategoriesPage() {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { run, busy } = useAction();

  const { data, error, loading, reload } = useAsync(listCategoriesWithCounts);
  const cats = data?.cats ?? [];

  const add = (n: string) =>
    run("add", () => addCategory(n, cats), {
      success: (added) => `Added ${added}`,
      failure: "Couldn't add category",
      refreshStore: true,
      onSuccess: () => {
        setName("");
        reload();
      },
    });

  const update = (c: Category, patch: Partial<Category>, msg: string) =>
    run(c.id, () => updateCategory(c.id, patch), { success: msg, failure: "Couldn't save", refreshStore: true, onSuccess: reload });

  // Re-number everything so positions stay clean.
  const move = (i: number, dir: -1 | 1) => run(cats[i].id, () => saveOrder("categories", swapped(cats, i, dir)), { refreshStore: true, onSuccess: reload });

  async function remove(c: Category) {
    if (!window.confirm(`Delete the empty category "${c.name}"?`)) return;
    await run(c.id, () => deleteCategory(c), { success: "Category deleted", failure: "Couldn't delete. Move its products first.", refreshStore: true, onSuccess: reload });
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Categories" hue="categories" icon="tag" />

      <Card>
        <form onSubmit={(e) => { e.preventDefault(); void add(name); }} className="flex gap-2">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Atta, Rice & Dal" maxLength={60} aria-label="New category name" />
          <button type="submit" disabled={busy === "add"} className="btn shrink-0 bg-fuchsia-600 text-white">
            <Icon name="plus" className="size-5" strokeWidth={2.6} /> Add
          </button>
        </form>
        {cats.length === 0 && !loading && (
          <div className="mt-3">
            <p className="hint mb-2">Tap to add common kirana categories:</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" disabled={!!busy} onClick={() => add(s)} className="rounded-full bg-fuchsia-50 px-3 py-1.5 text-[14px] font-semibold text-fuchsia-900 ring-1 ring-fuchsia-200">
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox text={error} retry={reload} />
      ) : cats.length === 0 ? (
        <Empty icon="tag" title="No categories yet" text="Categories are the shelves customers browse." />
      ) : (
        <>
          <p className="text-[14px] text-muted">The order here is the order on the website. Tap the photo box to add a category picture.</p>
          <ul className="space-y-2">
            {cats.map((c, i) => {
              const n = data?.count.get(c.id) ?? 0;
              return (
                <li key={c.id} className={`rounded-2xl bg-white p-3 ring-1 ring-line ${c.is_active ? "" : "opacity-70"}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button type="button" disabled={i === 0 || !!busy} onClick={() => move(i, -1)} className="rounded-md p-1 text-muted disabled:opacity-30" aria-label={`Move ${c.name} up`}>
                        <Icon name="right" className="size-4 -rotate-90" strokeWidth={2.6} />
                      </button>
                      <button type="button" disabled={i === cats.length - 1 || !!busy} onClick={() => move(i, 1)} className="rounded-md p-1 text-muted disabled:opacity-30" aria-label={`Move ${c.name} down`}>
                        <Icon name="right" className="size-4 rotate-90" strokeWidth={2.6} />
                      </button>
                    </div>
                    <CategoryPhoto c={c} onChanged={reload} />
                    {editing === c.id ? (
                      <form
                        className="flex flex-1 gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (editName.trim().length < 2) return;
                          setEditing(null);
                          void update(c, { name: editName.trim() }, "Renamed");
                        }}
                      >
                        <input className="field py-2" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} autoFocus />
                        <button type="submit" className="btn shrink-0 bg-fuchsia-600 px-3 text-white">Save</button>
                      </form>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-bold">{c.name}</span>
                          <Link href={`/admin/products?cat=${c.id}`} className="text-[13px] font-semibold text-teal-700">{n} product{n === 1 ? "" : "s"}</Link>
                        </span>
                        <button type="button" onClick={() => { setEditing(c.id); setEditName(c.name); }} className="rounded-lg bg-fuchsia-50 p-2 text-fuchsia-800" aria-label={`Rename ${c.name}`}>
                          <Icon name="edit" className="size-4" />
                        </button>
                        {n === 0 && (
                          <button type="button" onClick={() => remove(c)} className="rounded-lg bg-rose-50 p-2 text-rose-700" aria-label={`Delete ${c.name}`}>
                            <Icon name="trash" className="size-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="mt-2 border-t border-line pt-2">
                    <Switch checked={c.is_active} disabled={busy === c.id} onChange={(x) => update(c, { is_active: x }, x ? "Shown on website" : "Hidden from website")} label="Show on website" />
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
