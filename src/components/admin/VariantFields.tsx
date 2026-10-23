import { paiseToRupeesInput } from "@/lib/money";
import type { Variant } from "@/lib/catalog";

/** Size / price / stock inputs used by the add-product and edit-size forms. */
export function VariantFields({ v, idPrefix }: { v?: Partial<Variant>; idPrefix: string }) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const endsOn = v?.sale_ends_at
    ? new Date(v.sale_ends_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    : "";
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label" htmlFor={id("label")}>Size / pack</label>
        <input className="field" id={id("label")} name="label" defaultValue={v?.label ?? ""} placeholder="1 kg, 500 g, 1 L" maxLength={40} required />
      </div>
      <div>
        <label className="label" htmlFor={id("stock")}>Stock (pcs)</label>
        <input className="field" id={id("stock")} name="stock" type="number" inputMode="numeric" min={0} defaultValue={v?.stock_qty ?? ""} placeholder="0" />
      </div>
      <div>
        <label className="label" htmlFor={id("price")}>Selling price ₹</label>
        <input className="field" id={id("price")} name="price" inputMode="decimal" defaultValue={paiseToRupeesInput(v?.price_paise)} required />
      </div>
      <div>
        <label className="label" htmlFor={id("mrp")}>MRP ₹ (optional)</label>
        <input className="field" id={id("mrp")} name="mrp" inputMode="decimal" defaultValue={paiseToRupeesInput(v?.mrp_paise)} />
      </div>
      <details className="col-span-2" open={Boolean(v?.sale_price_paise)}>
        <summary className="cursor-pointer text-sm font-medium text-brand-700">Offer price (optional)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor={id("sale")}>Offer price ₹</label>
            <input className="field" id={id("sale")} name="sale_price" inputMode="decimal" defaultValue={paiseToRupeesInput(v?.sale_price_paise)} />
          </div>
          <div>
            <label className="label" htmlFor={id("ends")}>Offer ends on</label>
            <input className="field" id={id("ends")} name="sale_ends_on" type="date" defaultValue={endsOn} />
          </div>
        </div>
        <p className="hint">Leave the end date empty for an offer with no end. Clear the offer price to stop the offer.</p>
      </details>
    </div>
  );
}
