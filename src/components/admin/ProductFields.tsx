import type { Category } from "@/lib/catalog";

type P = {
  name?: string;
  category_id?: string;
  description?: string | null;
  search_keywords?: string | null;
};

export function ProductFields({ p, categories, defaultCategory }: { p?: P; categories: Category[]; defaultCategory?: string }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Product name</label>
        <input className="field" id="name" name="name" defaultValue={p?.name ?? ""} placeholder="Aashirvaad Whole Wheat Atta" maxLength={120} required autoFocus={!p} />
      </div>
      <div>
        <label className="label" htmlFor="category_id">Category</label>
        <select className="field" id="category_id" name="category_id" defaultValue={p?.category_id ?? defaultCategory ?? ""} required>
          <option value="" disabled>Choose…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (hidden)"}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="search_keywords">Other names customers search (optional)</label>
        <input className="field" id="search_keywords" name="search_keywords" defaultValue={p?.search_keywords ?? ""} placeholder="gehu, aata, chapati" maxLength={300} />
        <p className="hint">Hindi/Marathi words help: tel, shakkar, tup, dal…</p>
      </div>
      <div>
        <label className="label" htmlFor="description">Description (optional)</label>
        <textarea className="field" id="description" name="description" rows={3} defaultValue={p?.description ?? ""} maxLength={2000} />
      </div>
    </div>
  );
}
