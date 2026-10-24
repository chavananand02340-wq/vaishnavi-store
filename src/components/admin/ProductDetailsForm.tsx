"use client";

import type { Category } from "@/lib/catalog";
import { Switch } from "./ui";

export type DetailsForm = { name: string; category_id: string; search_keywords: string; description: string; is_active: boolean; is_featured: boolean };

export function ProductDetailsForm({ v, onChange, categories }: { v: DetailsForm; onChange: (v: DetailsForm) => void; categories: Category[] }) {
  const set = (k: keyof DetailsForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange({ ...v, [k]: e.target.value });
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="p-name">Product name</label>
        <input id="p-name" className="field" value={v.name} onChange={set("name")} placeholder="Aashirvaad Whole Wheat Atta" maxLength={120} />
      </div>
      <div>
        <label className="label" htmlFor="p-cat">Category</label>
        <select id="p-cat" className="field" value={v.category_id} onChange={set("category_id")}>
          <option value="" disabled>Choose a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (hidden)"}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="p-kw">Other words customers type (optional)</label>
        <input id="p-kw" className="field" value={v.search_keywords} onChange={set("search_keywords")} placeholder="gehu, aata, chapati" maxLength={300} />
        <p className="hint">Hindi and Marathi words help people find it: tel, shakkar, tup, dal.</p>
      </div>
      <div>
        <label className="label" htmlFor="p-desc">Description (optional)</label>
        <textarea id="p-desc" className="field min-h-[84px]" value={v.description} onChange={set("description")} maxLength={2000} />
      </div>
      <div className="space-y-2 rounded-xl bg-page p-3">
        <Switch checked={v.is_active} onChange={(x) => onChange({ ...v, is_active: x })} label="Show on website" hint="Turn off to hide it without deleting." />
        <Switch checked={v.is_featured} onChange={(x) => onChange({ ...v, is_featured: x })} label="Shop favourite" hint="Shown first on the home page." />
      </div>
    </div>
  );
}
