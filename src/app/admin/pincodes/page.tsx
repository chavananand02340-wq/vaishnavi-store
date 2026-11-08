"use client";

import { useState } from "react";
import { addPincode, deletePincode, listPincodes, updatePincode, type DeliveryPin as Pin } from "@/services/admin/settings";
import { formatPaise, paiseToRupeesInput, rupeesToPaise } from "@/lib/money";
import { useAsync } from "@/hooks/useAsync";
import { useAction } from "@/hooks/useAction";
import { useToast } from "@/components/ui/Toast";
import { Card, CardTitle, Empty, ErrorBox, PageTitle, Spinner, Switch } from "@/components/admin/AdminUI";
import { Icon } from "@/components/ui/Icon";

function PinRow({ p, baseFee, onChanged }: { p: Pin; baseFee: number; onChanged: () => void }) {
  const toast = useToast();
  const { run, isBusy: busy } = useAction();
  const [area, setArea] = useState(p.area_name ?? "");
  const [fee, setFee] = useState(paiseToRupeesInput(p.fee_override_paise));
  const dirty = area !== (p.area_name ?? "") || fee !== paiseToRupeesInput(p.fee_override_paise);

  const save = (patch: Partial<Pin>, msg: string) => run("save", () => updatePincode(p.pincode, patch), { success: msg, refreshStore: true, onSuccess: onChanged });
  async function saveText() {
    const f = fee.trim() ? rupeesToPaise(fee) : null;
    if (fee.trim() && f == null) return toast("Fee isn't a valid amount", "error");
    await save({ area_name: area.trim() || null, fee_override_paise: f }, `Saved ${p.pincode}`);
  }
  async function remove() {
    if (!window.confirm(`Stop delivering to ${p.pincode} and remove it? Past orders are not affected.`)) return;
    await run("remove", () => deletePincode(p.pincode), { success: `Removed ${p.pincode}`, onSuccess: onChanged });
  }

  return (
    <li className={`rounded-2xl bg-white p-4 ring-1 ${p.is_active ? "ring-sky-200" : "ring-line opacity-80"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex size-11 items-center justify-center rounded-xl ${p.is_active ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-600"}`}>
          <Icon name="pin" />
        </span>
        <span className="flex-1">
          <span className="block font-display text-[22px] font-extrabold leading-none">{p.pincode}</span>
          <span className="text-[13px] text-muted">
            {p.is_active ? "Delivering" : "Paused"}, fee {formatPaise(p.fee_override_paise ?? baseFee)}
          </span>
        </span>
        <button type="button" onClick={remove} disabled={busy} className="rounded-lg bg-rose-50 p-2 text-rose-700" aria-label={`Remove ${p.pincode}`}>
          <Icon name="trash" className="size-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor={`a-${p.pincode}`}>Area name</label>
          <input id={`a-${p.pincode}`} className="field py-2.5" value={area} onChange={(e) => setArea(e.target.value)} maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor={`f-${p.pincode}`}>Special fee ₹</label>
          <input id={`f-${p.pincode}`} className="field py-2.5" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder={`${baseFee / 100} (normal)`} />
        </div>
      </div>
      {dirty && (
        <button type="button" onClick={saveText} disabled={busy} className="btn mt-2 w-full bg-sky-600 text-white">Save {p.pincode}</button>
      )}
      <div className="mt-2 border-t border-line pt-2">
        <Switch checked={p.is_active} disabled={busy} onChange={(x) => save({ is_active: x }, x ? `Delivering to ${p.pincode}` : `Paused ${p.pincode}`)} label="Deliver here" />
      </div>
    </li>
  );
}

export default function PincodesPage() {
  const [pin, setPin] = useState("");
  const { run, isBusy: busy } = useAction();
  const { data, error, loading, reload } = useAsync(listPincodes);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await run("add", () => addPincode(pin), {
      success: `Now delivering to ${pin}`,
      onSuccess: () => {
        setPin("");
        reload();
      },
    });
  }

  return (
    <div className="space-y-4">
      <PageTitle title="PIN codes" hue="pincodes" icon="pin" />
      <Card>
        <CardTitle hint="Customers can only order if their PIN code is here and switched on.">Add a PIN code</CardTitle>
        <form onSubmit={add} className="flex gap-2">
          <input className="field" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="6-digit PIN" aria-label="PIN code" />
          <button type="submit" disabled={busy} className="btn shrink-0 bg-sky-600 text-white">
            <Icon name="plus" className="size-5" strokeWidth={2.6} /> Add
          </button>
        </form>
      </Card>
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox text={error} retry={reload} />
      ) : !data?.pins.length ? (
        <Empty icon="pin" title="No PIN codes" text="Nobody can order until you add at least one." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.pins.map((p) => <PinRow key={p.pincode} p={p} baseFee={data.baseFee} onChanged={reload} />)}
        </ul>
      )}
    </div>
  );
}
