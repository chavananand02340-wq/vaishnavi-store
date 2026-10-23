import { createClient } from "@/lib/supabase/server";
import { formatPaise, paiseToRupeesInput } from "@/lib/money";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { addPincode, deletePincode, updatePincode } from "../actions";

type Pin = { pincode: string; area_name: string | null; is_active: boolean; fee_override_paise: number | null };

export default async function PincodesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; removed?: string; error?: string }>;
}) {
  const { saved, removed, error } = await searchParams;
  const supabase = await createClient();
  const [{ data: pins }, { data: s }] = await Promise.all([
    supabase.from("delivery_pincodes").select("pincode, area_name, is_active, fee_override_paise").order("pincode"),
    supabase.from("store_settings").select("delivery_fee_paise").eq("id", 1).single(),
  ]);
  const defaultFee = s ? formatPaise(s.delivery_fee_paise) : "the store fee";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Delivery PIN codes</h1>
      <Notice
        ok={saved ? `PIN ${saved} saved.` : removed ? `PIN ${removed} removed.` : null}
        error={error ?? null}
      />

      <form action={addPincode} className="card space-y-3">
        <h2 className="font-semibold">Add a PIN code</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="new-pincode">PIN code</label>
            <input className="field" id="new-pincode" name="pincode" inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required />
          </div>
          <div>
            <label className="label" htmlFor="new-area">Area (optional)</label>
            <input className="field" id="new-area" name="area_name" maxLength={80} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="new-fee">Special delivery fee (₹, optional)</label>
          <input className="field" id="new-fee" name="fee_override" inputMode="decimal" />
          <p className="hint">Leave empty to use {defaultFee}. Free-delivery rule still applies.</p>
        </div>
        <SubmitButton pendingText="Adding…">Add PIN code</SubmitButton>
      </form>

      <section className="space-y-3">
        {(pins as Pin[] | null)?.length ? (
          (pins as Pin[]).map((p) => (
            <div key={p.pincode} className="card">
              <form action={updatePincode} className="space-y-3">
                <input type="hidden" name="pincode" value={p.pincode} />
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">{p.pincode}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? "bg-brand-50 text-brand-800" : "bg-neutral-100 text-neutral-600"}`}>
                    {p.is_active ? "Delivering" : "Paused"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor={`area-${p.pincode}`}>Area</label>
                    <input className="field" id={`area-${p.pincode}`} name="area_name" defaultValue={p.area_name ?? ""} maxLength={80} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`fee-${p.pincode}`}>Special fee (₹)</label>
                    <input className="field" id={`fee-${p.pincode}`} name="fee_override" inputMode="decimal"
                      defaultValue={paiseToRupeesInput(p.fee_override_paise)} placeholder="Default" />
                  </div>
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" name="is_active" defaultChecked={p.is_active} className="size-5 accent-brand-600" />
                  Deliver to this PIN code
                </label>
                <SubmitButton className="btn-ghost w-full">Save</SubmitButton>
              </form>
              <form action={deletePincode} className="mt-2">
                <input type="hidden" name="pincode" value={p.pincode} />
                <SubmitButton className="btn-danger w-full" pendingText="Removing…">Remove</SubmitButton>
              </form>
            </div>
          ))
        ) : (
          <p className="card text-sm text-neutral-600">No PIN codes yet. Customers cannot order until you add one.</p>
        )}
      </section>
    </div>
  );
}
