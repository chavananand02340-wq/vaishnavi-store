"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { formatPaise, paiseToRupeesInput, rupeesToPaise } from "@/lib/money";
import { useAsync, must } from "@/lib/useAsync";
import { refreshStorefront } from "@/components/admin/team";
import { Card, ErrorBox, Field, PageTitle, Spinner, Switch } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

type S = {
  store_name: string; tagline: string | null; address: string | null; phone_primary: string | null; phone_secondary: string | null;
  whatsapp_number: string | null; email: string | null; instagram_url: string | null; maps_url: string | null;
  open_time: string; close_time: string; accepting_orders: boolean; closed_message: string | null; announcement: string | null;
  delivery_fee_paise: number; free_delivery_enabled: boolean; free_delivery_threshold_paise: number; min_order_paise: number | null;
  default_eta_minutes: number; cod_enabled: boolean; upi_enabled: boolean; upi_id: string | null; upi_payee_name: string | null; low_stock_threshold: number;
};

type F = Record<
  "store_name" | "tagline" | "address" | "phone_primary" | "phone_secondary" | "whatsapp_number" | "email" | "instagram_url" | "maps_url" |
  "open_time" | "close_time" | "closed_message" | "announcement" | "delivery_fee" | "threshold" | "min_order" | "eta" | "upi_id" | "upi_payee_name" | "low_stock",
  string
> & { accepting_orders: boolean; free_delivery_enabled: boolean; cod_enabled: boolean; upi_enabled: boolean };

const toForm = (s: S): F => ({
  store_name: s.store_name, tagline: s.tagline ?? "", address: s.address ?? "", phone_primary: s.phone_primary ?? "", phone_secondary: s.phone_secondary ?? "",
  whatsapp_number: s.whatsapp_number ?? "", email: s.email ?? "", instagram_url: s.instagram_url ?? "", maps_url: s.maps_url ?? "",
  open_time: s.open_time.slice(0, 5), close_time: s.close_time.slice(0, 5), closed_message: s.closed_message ?? "", announcement: s.announcement ?? "",
  delivery_fee: paiseToRupeesInput(s.delivery_fee_paise), threshold: paiseToRupeesInput(s.free_delivery_threshold_paise), min_order: paiseToRupeesInput(s.min_order_paise),
  eta: String(s.default_eta_minutes), upi_id: s.upi_id ?? "", upi_payee_name: s.upi_payee_name ?? "", low_stock: String(s.low_stock_threshold),
  accepting_orders: s.accepting_orders, free_delivery_enabled: s.free_delivery_enabled, cod_enabled: s.cod_enabled, upi_enabled: s.upi_enabled,
});

const mobile = (v: string) => {
  const d = v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return d === "" ? null : /^[6-9]\d{9}$/.test(d) ? d : undefined;
};

function Section({ icon, color, title, children }: { icon: string; color: string; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2.5 text-[17px] font-bold">
        <span className={`flex size-9 items-center justify-center rounded-lg ${color}`}>
          <Icon name={icon} className="size-[18px]" strokeWidth={2.2} />
        </span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const [f, setF] = useState<F | null>(null);
  const [saving, setSaving] = useState(false);
  const { data, error, loading, reload } = useAsync(async () => must(await supabase().from("store_settings").select("*").eq("id", 1).single()) as S);
  useEffect(() => {
    if (data) setF(toForm(data));
  }, [data]);

  if (loading && !f) return <Spinner />;
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!f || !data) return <Spinner />;

  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(toForm(data));

  async function save() {
    if (!f) return;
    const fee = rupeesToPaise(f.delivery_fee);
    const threshold = rupeesToPaise(f.threshold);
    const minOrder = f.min_order.trim() ? rupeesToPaise(f.min_order) : null;
    const eta = Number(f.eta);
    const low = Number(f.low_stock);
    const p1 = mobile(f.phone_primary), p2 = mobile(f.phone_secondary), wa = mobile(f.whatsapp_number);
    if (f.store_name.trim().length < 2) return toast("Write the shop name", "error");
    if (fee == null) return toast("Delivery fee isn't a valid amount", "error");
    if (threshold == null) return toast("Free-delivery amount isn't valid", "error");
    if (f.min_order.trim() && minOrder == null) return toast("Minimum order isn't valid", "error");
    if (!Number.isInteger(eta) || eta < 5 || eta > 600) return toast("Delivery time must be 5 to 600 minutes", "error");
    if (!Number.isInteger(low) || low < 0) return toast("Low-stock number must be 0 or more", "error");
    if (p1 === undefined || p2 === undefined || wa === undefined) return toast("Phone numbers must be 10 digits", "error");
    if (f.upi_id.trim() && !/^[a-zA-Z0-9.\-_]{2,200}@[a-zA-Z]{2,64}$/.test(f.upi_id.trim())) return toast("UPI ID looks wrong, e.g. shopname@okaxis", "error");
    if (f.upi_enabled && (!f.upi_id.trim() || !f.upi_payee_name.trim())) return toast("To turn on UPI, add the UPI ID and name", "error");
    if (!/^\d{2}:\d{2}$/.test(f.open_time) || !/^\d{2}:\d{2}$/.test(f.close_time)) return toast("Set opening and closing time", "error");

    setSaving(true);
    const { error: e } = await supabase()
      .from("store_settings")
      .update({
        store_name: f.store_name.trim(), tagline: f.tagline.trim() || null, address: f.address.trim() || null,
        phone_primary: p1, phone_secondary: p2, whatsapp_number: wa, email: f.email.trim() || null,
        instagram_url: f.instagram_url.trim() || null, maps_url: f.maps_url.trim() || null,
        open_time: f.open_time, close_time: f.close_time, accepting_orders: f.accepting_orders,
        closed_message: f.closed_message.trim() || null, announcement: f.announcement.trim() || null,
        delivery_fee_paise: fee, free_delivery_enabled: f.free_delivery_enabled, free_delivery_threshold_paise: threshold, min_order_paise: minOrder,
        default_eta_minutes: eta, cod_enabled: f.cod_enabled, upi_enabled: f.upi_enabled, upi_id: f.upi_id.trim() || null, upi_payee_name: f.upi_payee_name.trim() || null,
        low_stock_threshold: low,
      })
      .eq("id", 1);
    setSaving(false);
    if (e) return toast(`Couldn't save: ${e.message}`, "error");
    toast("Settings saved");
    void refreshStorefront();
    reload();
  }

  const feePreview = rupeesToPaise(f.delivery_fee);
  const thPreview = rupeesToPaise(f.threshold);

  return (
    <div className="space-y-4">
      <PageTitle title="Shop settings" hue="settings" icon="settings" />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Section icon="clock" color="bg-amber-500 text-amber-950" title="Timing and orders">
            <Switch checked={f.accepting_orders} onChange={(x) => setF({ ...f, accepting_orders: x })} label="Take online orders" hint="Turn off for a holiday or a very busy day. People can still browse." />
            <div className="grid grid-cols-2 gap-3">
              <Field id="open" label="Opens at" type="time" value={f.open_time} onChange={set("open_time")} />
              <Field id="close" label="Closes at" type="time" value={f.close_time} onChange={set("close_time")} />
            </div>
            <Field id="eta" label="Delivery time (minutes)" type="number" inputMode="numeric" value={f.eta} onChange={set("eta")} hint="Shown to customers. Raise it on a rainy or busy day." />
            <Field id="closed" label="Message when closed (optional)" value={f.closed_message} onChange={set("closed_message")} maxLength={200} placeholder="Closed today for Diwali. Back tomorrow at 10 am." />
            <Field id="ann" label="Notice at the top of the store (optional)" value={f.announcement} onChange={set("announcement")} maxLength={200} placeholder="Fresh stock of Diwali dry fruits now in!" />
          </Section>

          <Section icon="truck" color="bg-violet-600 text-white" title="Delivery charges">
            <Field id="fee" label="Delivery fee ₹" inputMode="decimal" value={f.delivery_fee} onChange={set("delivery_fee")} />
            <Switch checked={f.free_delivery_enabled} onChange={(x) => setF({ ...f, free_delivery_enabled: x })} label="Free delivery on bigger orders" hint="When off, every order pays the delivery fee." />
            {f.free_delivery_enabled && <Field id="th" label="Free delivery from ₹" inputMode="decimal" value={f.threshold} onChange={set("threshold")} />}
            <Field id="min" label="Minimum order ₹ (optional)" inputMode="decimal" value={f.min_order} onChange={set("min_order")} hint="Leave empty for no minimum." />
            {feePreview != null && thPreview != null && (
              <p className="rounded-xl bg-violet-50 px-3 py-2.5 text-[14px] text-violet-900">
                Customers see:{" "}
                <b>
                  {f.free_delivery_enabled
                    ? `${formatPaise(feePreview)} delivery below ${formatPaise(thPreview)}, free from ${formatPaise(thPreview)}.`
                    : `${formatPaise(feePreview)} delivery on every order.`}
                </b>
              </p>
            )}
          </Section>

          <Section icon="rupee" color="bg-emerald-600 text-white" title="Payment">
            <Switch checked={f.cod_enabled} onChange={(x) => setF({ ...f, cod_enabled: x })} label="Cash on delivery" hint="Allowed on every order amount while on." />
            <Switch checked={f.upi_enabled} onChange={(x) => setF({ ...f, upi_enabled: x })} label="UPI QR payment" hint="Customer pays by QR. You confirm it in your UPI app." />
            <div className="grid grid-cols-2 gap-3">
              <Field id="upi" label="UPI ID" value={f.upi_id} onChange={set("upi_id")} placeholder="shop@okaxis" autoCapitalize="none" />
              <Field id="upin" label="Name on UPI" value={f.upi_payee_name} onChange={set("upi_payee_name")} maxLength={80} />
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section icon="store" color="bg-leaf-700 text-white" title="Shop details">
            <Field id="name" label="Shop name" value={f.store_name} onChange={set("store_name")} maxLength={80} />
            <Field id="tag" label="Short line under the name (optional)" value={f.tagline} onChange={set("tagline")} maxLength={120} placeholder="Your neighbourhood kirana since 1998" />
            <div>
              <label className="label" htmlFor="addr">Address</label>
              <textarea id="addr" className="field min-h-[80px]" value={f.address} onChange={set("address")} maxLength={300} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id="p1" label="Phone" type="tel" inputMode="numeric" value={f.phone_primary} onChange={set("phone_primary")} />
              <Field id="p2" label="Second phone" type="tel" inputMode="numeric" value={f.phone_secondary} onChange={set("phone_secondary")} />
            </div>
            <Field id="wa" label="WhatsApp number" type="tel" inputMode="numeric" value={f.whatsapp_number} onChange={set("whatsapp_number")} hint="Customers message this number from the website." />
            <Field id="email" label="Email (optional)" type="email" value={f.email} onChange={set("email")} />
            <Field id="ig" label="Instagram link" type="url" value={f.instagram_url} onChange={set("instagram_url")} />
            <Field id="maps" label="Google Maps link" type="url" value={f.maps_url} onChange={set("maps_url")} />
          </Section>

          <Section icon="alert" color="bg-rose-600 text-white" title="Stock alerts">
            <Field id="low" label="Warn me when stock is at or below" type="number" inputMode="numeric" value={f.low_stock} onChange={set("low_stock")} />
          </Section>
        </div>
      </div>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        <button type="button" onClick={save} disabled={saving || !dirty} className="btn w-full bg-slate-800 text-[16px] text-white shadow-lg">
          {saving ? "Saving…" : dirty ? "Save changes" : "All changes saved"}
        </button>
      </div>
    </div>
  );
}
