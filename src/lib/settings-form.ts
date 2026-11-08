import { AppError } from "@/lib/errors";
import { paiseToRupeesInput, rupeesToPaise } from "@/lib/money";
import { normalizeMobile } from "@/lib/checkout-form";
import { EMAIL_RE, isMobile } from "@/lib/validation";
import type { StoreSettings } from "@/types/settings";

/** Admin → Shop settings form: database row <-> text boxes, with every check. Pure. */

export type SettingsForm = Record<
  "store_name" | "tagline" | "address" | "phone_primary" | "phone_secondary" | "whatsapp_number" | "email" | "instagram_url" | "maps_url" |
  "open_time" | "close_time" | "closed_message" | "announcement" | "delivery_fee" | "threshold" | "min_order" | "eta" | "upi_id" | "upi_payee_name" | "low_stock" |
  "legal_name" | "gstin" | "fssai_number" | "support_email" | "notify_email",
  string
> & { accepting_orders: boolean; free_delivery_enabled: boolean; cod_enabled: boolean; upi_enabled: boolean; razorpay_enabled: boolean };

export const settingsToForm = (s: StoreSettings): SettingsForm => ({
  store_name: s.store_name, tagline: s.tagline ?? "", address: s.address ?? "", phone_primary: s.phone_primary ?? "", phone_secondary: s.phone_secondary ?? "",
  whatsapp_number: s.whatsapp_number ?? "", email: s.email ?? "", instagram_url: s.instagram_url ?? "", maps_url: s.maps_url ?? "",
  open_time: s.open_time.slice(0, 5), close_time: s.close_time.slice(0, 5), closed_message: s.closed_message ?? "", announcement: s.announcement ?? "",
  delivery_fee: paiseToRupeesInput(s.delivery_fee_paise), threshold: paiseToRupeesInput(s.free_delivery_threshold_paise), min_order: paiseToRupeesInput(s.min_order_paise),
  eta: String(s.default_eta_minutes), upi_id: s.upi_id ?? "", upi_payee_name: s.upi_payee_name ?? "", low_stock: String(s.low_stock_threshold),
  accepting_orders: s.accepting_orders, free_delivery_enabled: s.free_delivery_enabled, cod_enabled: s.cod_enabled, upi_enabled: s.upi_enabled, razorpay_enabled: s.razorpay_enabled ?? false,
  legal_name: s.legal_name ?? "", gstin: s.gstin ?? "", fssai_number: s.fssai_number ?? "", support_email: s.support_email ?? "", notify_email: s.notify_email ?? "",
});

/** Optional mobile: "" → null, valid → 10 digits, anything else → undefined (invalid). */
const mobile = (v: string) => {
  const d = normalizeMobile(v);
  return d === "" ? null : isMobile(d) ? d : undefined;
};

/**
 * Checks the form and returns the update for store_settings.
 * Throws AppError("invalid") naming the first thing to fix.
 * `hasRazorpay` = the razorpay_enabled column exists (SQL part 24).
 */
export function settingsFromForm(f: SettingsForm, hasRazorpay: boolean): Partial<StoreSettings> {
  const bad = (m: string) => new AppError("invalid", m);
  const fee = rupeesToPaise(f.delivery_fee);
  const threshold = rupeesToPaise(f.threshold);
  const minOrder = f.min_order.trim() ? rupeesToPaise(f.min_order) : null;
  const eta = Number(f.eta);
  const low = Number(f.low_stock);
  const p1 = mobile(f.phone_primary), p2 = mobile(f.phone_secondary), wa = mobile(f.whatsapp_number);
  if (f.store_name.trim().length < 2) throw bad("Write the shop name");
  if (fee == null) throw bad("Delivery fee isn't a valid amount");
  if (threshold == null) throw bad("Free-delivery amount isn't valid");
  if (f.min_order.trim() && minOrder == null) throw bad("Minimum order isn't valid");
  if (!Number.isInteger(eta) || eta < 5 || eta > 600) throw bad("Delivery time must be 5 to 600 minutes");
  if (!Number.isInteger(low) || low < 0) throw bad("Low-stock number must be 0 or more");
  if (p1 === undefined || p2 === undefined || wa === undefined) throw bad("Phone numbers must be 10 digits");
  if (f.upi_id.trim() && !/^[a-zA-Z0-9.\-_]{2,200}@[a-zA-Z]{2,64}$/.test(f.upi_id.trim())) throw bad("UPI ID looks wrong, e.g. shopname@okaxis");
  if (f.upi_enabled && (!f.upi_id.trim() || !f.upi_payee_name.trim())) throw bad("To turn on UPI, add the UPI ID and name");
  if (f.support_email.trim() && !EMAIL_RE.test(f.support_email.trim())) throw bad("Support email looks wrong");
  if (f.notify_email.trim() && !EMAIL_RE.test(f.notify_email.trim())) throw bad("Order alert email looks wrong");
  if (!/^\d{2}:\d{2}$/.test(f.open_time) || !/^\d{2}:\d{2}$/.test(f.close_time)) throw bad("Set opening and closing time");
  return {
    store_name: f.store_name.trim(), tagline: f.tagline.trim() || null, address: f.address.trim() || null,
    phone_primary: p1, phone_secondary: p2, whatsapp_number: wa, email: f.email.trim() || null,
    instagram_url: f.instagram_url.trim() || null, maps_url: f.maps_url.trim() || null,
    open_time: f.open_time, close_time: f.close_time, accepting_orders: f.accepting_orders,
    closed_message: f.closed_message.trim() || null, announcement: f.announcement.trim() || null,
    delivery_fee_paise: fee, free_delivery_enabled: f.free_delivery_enabled, free_delivery_threshold_paise: threshold, min_order_paise: minOrder,
    default_eta_minutes: eta, cod_enabled: f.cod_enabled, upi_enabled: f.upi_enabled, upi_id: f.upi_id.trim() || null, upi_payee_name: f.upi_payee_name.trim() || null,
    low_stock_threshold: low,
    ...(hasRazorpay ? { razorpay_enabled: f.razorpay_enabled } : {}),
    legal_name: f.legal_name.trim() || null, gstin: f.gstin.trim().toUpperCase() || null, fssai_number: f.fssai_number.trim() || null,
    support_email: f.support_email.trim() || null, notify_email: f.notify_email.trim() || null,
  };
}
