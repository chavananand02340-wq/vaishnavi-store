import { createClient } from "@/lib/supabase/server";
import { paiseToRupeesInput } from "@/lib/money";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { saveSettings } from "../actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const supabase = await createClient();
  const { data: s } = await supabase.from("store_settings").select("*").eq("id", 1).single();

  if (!s) return <Notice error="Store settings row is missing. Run the database migration." />;

  return (
    <form action={saveSettings} className="space-y-5">
      <h1 className="text-xl font-bold">Store & delivery settings</h1>
      <Notice ok={saved ? "Settings saved." : null} error={error ?? null} />

      <Section title="Orders & timing">
        <Toggle name="accepting_orders" label="Accepting online orders" defaultChecked={s.accepting_orders}
          hint="Turn off for holidays or rush. Customers can still browse." />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opens at" name="open_time" type="time" defaultValue={s.open_time.slice(0, 5)} required />
          <Field label="Closes at" name="close_time" type="time" defaultValue={s.close_time.slice(0, 5)} required />
        </div>
        <Field label="Expected delivery time (minutes)" name="default_eta_minutes" type="number" inputMode="numeric"
          min={5} max={600} defaultValue={s.default_eta_minutes} required
          hint="Shown to customers. Increase during rush or rain." />
        <Field label="Message when closed" name="closed_message" defaultValue={s.closed_message ?? ""} maxLength={200}
          placeholder="Store closed. Orders open at 10 AM." />
        <Field label="Announcement banner (optional)" name="announcement" defaultValue={s.announcement ?? ""} maxLength={200} />
      </Section>

      <Section title="Delivery charges">
        <Field label="Delivery fee (₹)" name="delivery_fee" inputMode="decimal"
          defaultValue={paiseToRupeesInput(s.delivery_fee_paise)} required />
        <Toggle name="free_delivery_enabled" label="Free delivery above a minimum amount" defaultChecked={s.free_delivery_enabled}
          hint="When off, the delivery fee applies to every order." />
        <Field label="Free delivery from (₹)" name="free_delivery_threshold" inputMode="decimal"
          defaultValue={paiseToRupeesInput(s.free_delivery_threshold_paise)} required
          hint="Orders at or above this amount get free delivery." />
        <Field label="Minimum order amount (₹, optional)" name="min_order" inputMode="decimal"
          defaultValue={paiseToRupeesInput(s.min_order_paise)} hint="Leave empty for no minimum." />
      </Section>

      <Section title="Payment">
        <Toggle name="cod_enabled" label="Cash on Delivery" defaultChecked={s.cod_enabled}
          hint="Available on every order amount while this is on." />
        <Toggle name="upi_enabled" label="UPI QR payment" defaultChecked={s.upi_enabled}
          hint="Needs a UPI ID. You confirm each payment manually." />
        <Field label="UPI ID" name="upi_id" defaultValue={s.upi_id ?? ""} placeholder="storename@okaxis" autoCapitalize="none" />
        <Field label="UPI payee name" name="upi_payee_name" defaultValue={s.upi_payee_name ?? ""} maxLength={80} />
      </Section>

      <Section title="Store details">
        <Field label="Store name" name="store_name" defaultValue={s.store_name} required maxLength={80} />
        <Field label="Tagline (optional)" name="tagline" defaultValue={s.tagline ?? ""} maxLength={120} />
        <Field label="Address" name="address" defaultValue={s.address ?? ""} maxLength={300} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" name="phone_primary" type="tel" inputMode="numeric" defaultValue={s.phone_primary ?? ""} />
          <Field label="Second phone" name="phone_secondary" type="tel" inputMode="numeric" defaultValue={s.phone_secondary ?? ""} />
        </div>
        <Field label="WhatsApp number" name="whatsapp_number" type="tel" inputMode="numeric" defaultValue={s.whatsapp_number ?? ""}
          hint="Used for 'Order on WhatsApp' and bulk-quantity buttons." />
        <Field label="Email (optional)" name="email" type="email" defaultValue={s.email ?? ""} />
        <Field label="Instagram link" name="instagram_url" type="url" defaultValue={s.instagram_url ?? ""} />
        <Field label="Google Maps link" name="maps_url" type="url" defaultValue={s.maps_url ?? ""} />
      </Section>

      <Section title="Stock alerts">
        <Field label="Warn when stock is at or below" name="low_stock_threshold" type="number" inputMode="numeric"
          min={0} defaultValue={s.low_stock_threshold} />
      </Section>

      <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
        <SubmitButton className="btn-primary w-full">Save settings</SubmitButton>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="card space-y-4">
      <legend className="px-1 text-sm font-semibold text-brand-800">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  hint,
  name,
  ...props
}: { label: string; hint?: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="field" id={name} name={name} {...props} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-5 accent-brand-600" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="hint block">{hint}</span>}
      </span>
    </label>
  );
}
