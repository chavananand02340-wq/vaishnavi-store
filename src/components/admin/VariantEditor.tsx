"use client";

import type { VariantForm } from "@/lib/catalog-admin";

/** Size / price / stock inputs. Controlled: parent keeps the state. */
export function VariantEditor({ v, onChange, idp }: { v: VariantForm; onChange: (v: VariantForm) => void; idp: string }) {
  const set = (k: keyof VariantForm) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...v, [k]: e.target.value });
  const id = (k: string) => `${idp}-${k}`;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label" htmlFor={id("label")}>Pack size</label>
        <input id={id("label")} className="field" value={v.label} onChange={set("label")} placeholder="1 kg" maxLength={40} />
      </div>
      <div>
        <label className="label" htmlFor={id("stock")}>Stock (pieces)</label>
        <input id={id("stock")} className="field" type="number" inputMode="numeric" min={0} value={v.stock} onChange={set("stock")} placeholder="0" />
      </div>
      <div>
        <label className="label" htmlFor={id("price")}>Selling price ₹</label>
        <input id={id("price")} className="field" inputMode="decimal" value={v.price} onChange={set("price")} placeholder="55" />
      </div>
      <div>
        <label className="label" htmlFor={id("mrp")}>MRP ₹ (optional)</label>
        <input id={id("mrp")} className="field" inputMode="decimal" value={v.mrp} onChange={set("mrp")} placeholder="60" />
      </div>
      <details className="col-span-2 rounded-xl bg-page px-3 py-2" open={Boolean(v.sale)}>
        <summary className="cursor-pointer text-[14px] font-bold text-kumkum-600">Offer price (optional)</summary>
        <div className="mt-2 grid grid-cols-2 gap-3 pb-1">
          <div>
            <label className="label" htmlFor={id("sale")}>Offer price ₹</label>
            <input id={id("sale")} className="field" inputMode="decimal" value={v.sale} onChange={set("sale")} />
          </div>
          <div>
            <label className="label" htmlFor={id("ends")}>Offer ends on</label>
            <input id={id("ends")} className="field" type="date" value={v.saleEnds} onChange={set("saleEnds")} />
          </div>
          <p className="hint col-span-2">No end date means the offer runs until you clear the offer price.</p>
        </div>
      </details>
    </div>
  );
}
