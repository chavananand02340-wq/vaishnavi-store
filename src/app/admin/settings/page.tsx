"use client";

import { useEffect, useState } from "react";
import { getStoreSettings, updateStoreSettings } from "@/services/admin/settings";
import { settingsFromForm, settingsToForm, type SettingsForm as F } from "@/lib/settings-form";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { useAsync } from "@/hooks/useAsync";
import { useAction } from "@/hooks/useAction";
import { Card, ErrorBox, Field, PageTitle, Spinner, Switch } from "@/components/admin/AdminUI";
import { Icon } from "@/components/ui/Icon";
import { SystemCheck } from "@/components/admin/SystemCheck";

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
  const [f, setF] = useState<F | null>(null);
  const { run, isBusy: saving } = useAction();
  const { data, error, loading, reload } = useAsync(getStoreSettings);
  useEffect(() => {
    if (data) setF(settingsToForm(data));
  }, [data]);

  if (loading && !f) return <Spinner />;
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!f || !data) return <Spinner />;

  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(settingsToForm(data));

  async function save() {
    if (!f || !data) return;
    await run("save", async () => updateStoreSettings(settingsFromForm(f, "razorpay_enabled" in data)), {
      success: "Settings saved",
      refreshStore: true,
      onSuccess: reload,
    });
  }

  const feePreview = rupeesToPaise(f.delivery_fee);
  const thPreview = rupeesToPaise(f.threshold);

  return (
    <div className="space-y-4">
      <PageTitle title="Shop settings" hue="settings" icon="settings" />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <a href="/admin/banners" className="flex items-center gap-3 rounded-2xl bg-orange-50 p-4 text-orange-900 ring-1 ring-orange-200">
            <Icon name="gift" className="size-6" />
            <span className="flex-1"><b className="block">Sale / offer banner</b><span className="text-[13px]">Diwali sale, % off badge: now in Banners</span></span>
            <Icon name="right" className="size-5" />
          </a>
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
            <Switch
              checked={f.razorpay_enabled}
              disabled={!("razorpay_enabled" in data)}
              onChange={(x) => setF({ ...f, razorpay_enabled: x })}
              label="Online payment (Razorpay)"
              hint={"razorpay_enabled" in data ? "UPI apps, cards, netbanking. Marked paid automatically." : "Run SQL parts 24 and 25 first."}
            />
            <Switch checked={f.cod_enabled} onChange={(x) => setF({ ...f, cod_enabled: x })} label="Cash on delivery" hint="Allowed on every order amount while on." />
            <Switch checked={f.upi_enabled} onChange={(x) => setF({ ...f, upi_enabled: x })} label="UPI QR payment (old way)" hint="Customer scans your QR. You confirm it in your UPI app. Turn off once Razorpay is on." />
            <div className="grid grid-cols-2 gap-3">
              <Field id="upi" label="UPI ID" value={f.upi_id} onChange={set("upi_id")} placeholder="shop@okaxis" autoCapitalize="none" />
              <Field id="upin" label="Name on UPI" value={f.upi_payee_name} onChange={set("upi_payee_name")} maxLength={80} />
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section icon="store" color="bg-brand-700 text-white" title="Shop details">
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

          <Section icon="mail" color="bg-sky-600 text-white" title="Order emails">
            <Field id="notify" label="Send new-order emails to" type="email" value={f.notify_email} onChange={set("notify_email")} placeholder="vaishnavistore.web@gmail.com" hint="You get an email for every new order. Leave empty to turn off." />
          </Section>

          <Section icon="doc" color="bg-slate-700 text-white" title="Legal details (shown on policy pages and footer)">
            <Field id="legal" label="Registered business name" value={f.legal_name} onChange={set("legal_name")} maxLength={120} placeholder="Vaishnavi Store (Prop. Sangita Shiwarkar)" />
            <div className="grid grid-cols-2 gap-3">
              <Field id="fssai" label="FSSAI licence no." value={f.fssai_number} onChange={set("fssai_number")} maxLength={20} inputMode="numeric" />
              <Field id="gst" label="GSTIN (optional)" value={f.gstin} onChange={set("gstin")} maxLength={20} autoCapitalize="characters" />
            </div>
            <Field id="semail" label="Customer support email" type="email" value={f.support_email} onChange={set("support_email")} maxLength={120} />
          </Section>

          <SystemCheck />

          <Section icon="alert" color="bg-rose-600 text-white" title="Stock alerts">
            <Field id="low" label="Warn me when stock is at or below" type="number" inputMode="numeric" value={f.low_stock} onChange={set("low_stock")} />
          </Section>
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
          <button type="button" onClick={save} disabled={saving} className="btn w-full bg-slate-800 text-[16px] text-white shadow-lg">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
