"use client";

import { supabase } from "@/services/supabase/browser";
import { AppError, unwrap } from "@/lib/errors";
import { istDayStartISO } from "@/lib/time";
import { isPincode } from "@/lib/validation";
import type { StoreSettings } from "@/types/settings";
import type { OrderSummary } from "@/types/order";
import { ACTIVE_STATUSES } from "@/services/admin/orders";

/** Shop panel: shop settings, delivery PIN codes and the home dashboard. */

// ---------- Settings ----------

export async function getStoreSettings(): Promise<StoreSettings> {
  return unwrap(await supabase().from("store_settings").select("*").eq("id", 1).single(), "Couldn't load settings.") as StoreSettings;
}

export async function updateStoreSettings(patch: Partial<StoreSettings>) {
  unwrap(await supabase().from("store_settings").update(patch).eq("id", 1), "Couldn't save settings");
}

export const setAcceptingOrders = (on: boolean) => updateStoreSettings({ accepting_orders: on });

// ---------- Delivery PIN codes ----------

export type DeliveryPin = { pincode: string; area_name: string | null; is_active: boolean; fee_override_paise: number | null };

export async function listPincodes() {
  const sb = supabase();
  const [p, s] = await Promise.all([
    sb.from("delivery_pincodes").select("pincode, area_name, is_active, fee_override_paise").order("pincode"),
    sb.from("store_settings").select("delivery_fee_paise").eq("id", 1).single(),
  ]);
  return { pins: unwrap(p, "Couldn't load PIN codes.") as DeliveryPin[], baseFee: (s.data?.delivery_fee_paise as number) ?? 3000 };
}

export async function addPincode(pin: string) {
  if (!isPincode(pin)) throw new AppError("invalid", "PIN code must be 6 digits");
  const { error } = await supabase().from("delivery_pincodes").insert({ pincode: pin, is_active: true });
  if (error?.code === "23505") throw new AppError("conflict", "That PIN code is already in the list", { cause: error });
  if (error) throw new AppError("unknown", "Couldn't add PIN code", { cause: error });
}

export async function updatePincode(pin: string, patch: Partial<Omit<DeliveryPin, "pincode">>) {
  unwrap(await supabase().from("delivery_pincodes").update(patch).eq("pincode", pin), "Couldn't save");
}

export async function deletePincode(pin: string) {
  unwrap(await supabase().from("delivery_pincodes").delete().eq("pincode", pin), "Couldn't remove");
}

// ---------- Dashboard ----------

export type DashboardSettings = Pick<
  StoreSettings,
  "accepting_orders" | "open_time" | "close_time" | "low_stock_threshold" | "delivery_fee_paise" | "free_delivery_threshold_paise" | "free_delivery_enabled" | "default_eta_minutes"
>;

/** Today's numbers for the owner's home screen. */
export async function getDashboard() {
  const sb = supabase();
  const [s, today, active, recent, low] = await Promise.all([
    sb.from("store_settings").select("accepting_orders, open_time, close_time, low_stock_threshold, delivery_fee_paise, free_delivery_threshold_paise, free_delivery_enabled, default_eta_minutes").eq("id", 1).single(),
    sb.from("orders").select("total_paise, status").gte("created_at", istDayStartISO()),
    sb.from("orders").select("id", { count: "exact", head: true }).in("status", ACTIVE_STATUSES),
    sb.from("orders").select("id, order_no, customer_name, phone, total_paise, status, payment_method, payment_status, created_at").order("created_at", { ascending: false }).limit(6),
    sb.from("product_variants").select("id, stock_qty").eq("is_active", true),
  ]);
  const settings = unwrap(s, "Couldn't load the shop settings.") as DashboardSettings;
  const t = (unwrap(today, "Couldn't load today's orders.") ?? []) as { total_paise: number; status: string }[];
  return {
    settings,
    todayCount: t.length,
    todaySales: t.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total_paise, 0),
    active: active.count ?? 0,
    recent: (unwrap(recent, "Couldn't load recent orders.") ?? []) as OrderSummary[],
    lowStock: ((low.data ?? []) as { stock_qty: number }[]).filter((v) => v.stock_qty <= settings.low_stock_threshold).length,
  };
}
