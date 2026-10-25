"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { useAsync, must } from "@/lib/useAsync";
import { Card, CardTitle, Empty, ErrorBox, PageTitle, Spinner, Switch } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "flat";
  value: number;
  min_order_paise: number;
  max_discount_paise: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  per_phone_limit: number | null;
  show_in_checkout: boolean;
  is_active: boolean;
};

type Form = {
  code: string;
  description: string;
  kind: "percent" | "flat";
  value: string;
  min_order: string;
  max_discount: string;
  ends_on: string;
  usage_limit: string;
  once_per_customer: boolean;
  show_in_checkout: boolean;
};

const BLANK: Form = { code: "", description: "", kind: "percent", value: "", min_order: "", max_discount: "", ends_on: "", usage_limit: "", once_per_customer: true, show_in_checkout: true };

const SELECT = "id, code, description, kind, value, min_order_paise, max_discount_paise, starts_at, ends_at, usage_limit, used_count, per_phone_limit, show_in_checkout, is_active";

function summary(c: Pick<Coupon, "kind" | "value" | "min_order_paise" | "max_discount_paise">) {
  const off = c.kind === "percent" ? `${c.value}% off` : `${formatPaise(c.value)} off`;
  const cap = c.kind === "percent" && c.max_discount_paise ? `, up to ${formatPaise(c.max_discount_paise)}` : "";
  const min = c.min_order_paise ? ` on ${formatPaise(c.min_order_paise)}+` : "";
  return off + cap + min;
}

function status(c: Coupon): { text: string; cls: string } {
  const now = Date.now();
  if (!c.is_active) return { text: "Off", cls: "bg-slate-200 text-slate-700" };
  if (c.ends_at && new Date(c.ends_at).getTime() <= now) return { text: "Expired", cls: "bg-rose-100 text-rose-800" };
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return { text: "Starts later", cls: "bg-amber-100 text-amber-900" };
  if (c.usage_limit != null && c.used_count >= c.usage_limit) return { text: "Used up", cls: "bg-rose-100 text-rose-800" };
  return { text: "Live", cls: "bg-emerald-100 text-emerald-800" };
}

/** End of the chosen day, India time. */
function endOfDayIST(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return new Date(`${date}T23:59:59+05:30`).toISOString();
}

function CouponRow({ c, onChanged }: { c: Coupon; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const st = status(c);

  async function patch(p: Partial<Coupon>, msg: string) {
    setBusy(true);
    const { error } = await supabase().from("coupons").update(p).eq("id", c.id);
    setBusy(false);
    if (error) return toast("Couldn't save", "error");
    toast(msg);
    onChanged();
  }
  async function remove() {
    if (!window.confirm(`Delete coupon ${c.code}? Past orders keep their discount.`)) return;
    setBusy(true);
    const { error } = await supabase().from("coupons").delete().eq("id", c.id);
    setBusy(false);
    if (error) return toast("Couldn't delete", "error");
    toast(`Deleted ${c.code}`);
    onChanged();
  }

  return (
    <li className={`rounded-2xl bg-white p-4 ring-1 ${st.text === "Live" ? "ring-emerald-200" : "ring-line"}`}>
      <div className="flex items-start gap-3">
        <span className="rounded-lg border-2 border-dashed border-emerald-600 bg-emerald-50 px-2.5 py-1.5 font-display text-[18px] font-extrabold tracking-wide text-emerald-800">{c.code}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{summary(c)}</span>
          {c.description && <span className="block text-[13px] text-muted">{c.description}</span>}
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${st.cls}`}>{st.text}</span>
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Used {c.used_count}
        {c.usage_limit ? ` of ${c.usage_limit}` : ""} times
        {c.per_phone_limit ? `, ${c.per_phone_limit === 1 ? "once" : `${c.per_phone_limit} times`} per customer` : ""}
        {c.ends_at ? `, ends ${new Date(c.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}` : ", no end date"}
      </p>
      <div className="mt-2 grid gap-1 border-t border-line pt-2">
        <Switch checked={c.is_active} disabled={busy} onChange={(x) => patch({ is_active: x }, x ? `${c.code} is on` : `${c.code} is off`)} label="Coupon on" />
        <Switch checked={c.show_in_checkout} disabled={busy} onChange={(x) => patch({ show_in_checkout: x }, x ? "Shown at checkout" : "Hidden: works only if typed")} label="Show at checkout" hint="Off = secret code, works only if the customer types it" />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(c.code);
            toast(`Copied ${c.code}`);
          }}
          className="btn-plain flex-1 py-2 text-[14px]"
        >
          <Icon name="copy" className="size-4" /> Copy code
        </button>
        <button type="button" onClick={remove} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-4 text-[14px] font-bold text-rose-700">
          <Icon name="trash" className="size-4" /> Delete
        </button>
      </div>
    </li>
  );
}

export default function CouponsPage() {
  const toast = useToast();
  const [f, setF] = useState<Form>(BLANK);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { data, error, loading, reload } = useAsync(async () => must(await supabase().from("coupons").select(SELECT).order("created_at", { ascending: false })) as Coupon[]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: k === "code" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[A-Z0-9]{3,20}$/.test(f.code)) return toast("Code: 3 to 20 letters or numbers, no spaces", "error");
    let value: number | null;
    if (f.kind === "percent") {
      value = Number(f.value);
      if (!Number.isInteger(value) || value < 1 || value > 90) return toast("Percent must be a whole number from 1 to 90", "error");
    } else {
      value = rupeesToPaise(f.value);
      if (!value || value <= 0) return toast("Enter the rupees off", "error");
    }
    const min = f.min_order.trim() ? rupeesToPaise(f.min_order) : 0;
    if (min == null) return toast("Minimum order isn't a valid amount", "error");
    const cap = f.kind === "percent" && f.max_discount.trim() ? rupeesToPaise(f.max_discount) : null;
    if (f.kind === "percent" && f.max_discount.trim() && !cap) return toast("Maximum discount isn't a valid amount", "error");
    const limit = f.usage_limit.trim() ? Number(f.usage_limit) : null;
    if (limit != null && (!Number.isInteger(limit) || limit < 1)) return toast("Total uses must be a whole number", "error");
    const ends = f.ends_on ? endOfDayIST(f.ends_on) : null;

    setBusy(true);
    const { error: err } = await supabase().from("coupons").insert({
      code: f.code,
      description: f.description.trim() || null,
      kind: f.kind,
      value,
      min_order_paise: min,
      max_discount_paise: cap,
      ends_at: ends,
      usage_limit: limit,
      per_phone_limit: f.once_per_customer ? 1 : null,
      show_in_checkout: f.show_in_checkout,
      is_active: true,
    });
    setBusy(false);
    if (err) return toast(err.code === "23505" ? `${f.code} already exists` : "Couldn't create coupon", "error");
    toast(`Coupon ${f.code} is live`);
    setF(BLANK);
    setShowForm(false);
    reload();
  }

  const preview = f.value
    ? summary({
        kind: f.kind,
        value: f.kind === "percent" ? Number(f.value) || 0 : rupeesToPaise(f.value) ?? 0,
        min_order_paise: rupeesToPaise(f.min_order) ?? 0,
        max_discount_paise: rupeesToPaise(f.max_discount),
      })
    : null;

  return (
    <div className="space-y-4">
      <PageTitle
        title="Coupons"
        hue="coupons"
        icon="percent"
        action={
          !showForm && (
            <button type="button" onClick={() => setShowForm(true)} className="btn bg-emerald-600 px-4 text-white">
              <Icon name="plus" className="size-5" strokeWidth={2.6} /> New
            </button>
          )
        }
      />

      {showForm && (
        <Card>
          <CardTitle hint="Customers enter the code at checkout. The discount is worked out by the shop's system, never by the phone.">New coupon</CardTitle>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="label" htmlFor="code">Code</label>
              <input id="code" className="field font-bold uppercase tracking-wide" value={f.code} onChange={set("code")} maxLength={20} placeholder="DIWALI10" autoComplete="off" />
            </div>
            <div>
              <span className="label">Discount type</span>
              <div className="grid grid-cols-2 gap-2">
                {(["percent", "flat"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setF((p) => ({ ...p, kind: k }))}
                    className={`rounded-xl border-2 px-3 py-3 text-[15px] font-bold ${f.kind === k ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-line"}`}
                  >
                    {k === "percent" ? "% off" : "₹ off"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="value">{f.kind === "percent" ? "Percent off" : "Rupees off"}</label>
                <input id="value" className="field" inputMode={f.kind === "percent" ? "numeric" : "decimal"} value={f.value} onChange={set("value")} placeholder={f.kind === "percent" ? "10" : "50"} />
              </div>
              <div>
                <label className="label" htmlFor="min">Min. order ₹</label>
                <input id="min" className="field" inputMode="decimal" value={f.min_order} onChange={set("min_order")} placeholder="0" />
              </div>
              {f.kind === "percent" && (
                <div>
                  <label className="label" htmlFor="cap">Max discount ₹</label>
                  <input id="cap" className="field" inputMode="decimal" value={f.max_discount} onChange={set("max_discount")} placeholder="No limit" />
                </div>
              )}
              <div>
                <label className="label" htmlFor="ends">Last day</label>
                <input id="ends" type="date" className="field" value={f.ends_on} onChange={set("ends_on")} />
              </div>
              <div>
                <label className="label" htmlFor="limit">Total uses</label>
                <input id="limit" className="field" inputMode="numeric" value={f.usage_limit} onChange={set("usage_limit")} placeholder="No limit" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="desc">Line shown to customers (optional)</label>
              <input id="desc" className="field" value={f.description} onChange={set("description")} maxLength={140} placeholder="Diwali offer: 10% off above ₹500" />
            </div>
            <div className="grid gap-1 rounded-xl bg-page p-2">
              <Switch checked={f.once_per_customer} onChange={(x) => setF((p) => ({ ...p, once_per_customer: x }))} label="Once per customer" hint="Checked by mobile number" />
              <Switch checked={f.show_in_checkout} onChange={(x) => setF((p) => ({ ...p, show_in_checkout: x }))} label="Show at checkout" hint="Off = secret code" />
            </div>
            {preview && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-[15px] font-semibold text-emerald-800">
                {f.code || "CODE"}: {preview}
                {f.ends_on ? `, till ${new Date(f.ends_on).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowForm(false); setF(BLANK); }} className="btn-plain flex-1">Cancel</button>
              <button type="submit" disabled={busy} className="btn flex-[2] bg-emerald-600 text-white">{busy ? "Saving…" : "Create coupon"}</button>
            </div>
          </form>
        </Card>
      )}

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox text={error} retry={reload} />
      ) : !data?.length ? (
        !showForm && <Empty icon="percent" title="No coupons yet" text="Make one like DIWALI10 for 10% off. Customers apply it at checkout." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((c) => <CouponRow key={c.id} c={c} onChanged={reload} />)}
        </ul>
      )}
      <p className="text-[13px] text-muted">Tip: to show a coupon on the big home banner, pick it in Shop settings → Sale banner. Ends at 11:59 pm on the last day.</p>
    </div>
  );
}
