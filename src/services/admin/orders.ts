"use client";

import { supabase } from "@/services/supabase/browser";
import { unwrap } from "@/lib/errors";
import { istDateKey, istDayStartISO } from "@/lib/time";
import { FALLBACK_STORE_NAME } from "@/config/site";
import type { ActionResult, OrderHistoryEntry, OrderRow, OrderStatus, OrderSummary } from "@/types/order";

/** Shop panel: reading and moving orders. */

/** `*` so the panel keeps working before/after optional SQL parts (e.g. part 26 location). */
const ORDER_SELECT = "*, order_items(id, product_name, variant_label, qty, unit_price_paise, line_total_paise, is_unavailable)";
const SUMMARY_SELECT = "id, order_no, customer_name, phone, total_paise, status, payment_method, payment_status, created_at";
export const ACTIVE_STATUSES: OrderStatus[] = ["new", "confirmed", "out_for_delivery"];

/** Online orders count as "new" only once paid. */
export const isAwaitingOnlinePayment = (o: Pick<OrderRow, "payment_method" | "payment_status">) => o.payment_method === "online" && o.payment_status !== "paid";

/** Shop name and usual delivery time, shown on order cards. */
async function cardContext() {
  const { data } = await supabase().from("store_settings").select("store_name, default_eta_minutes").eq("id", 1).single();
  return { storeName: (data?.store_name as string) ?? FALLBACK_STORE_NAME, eta: (data?.default_eta_minutes as number) ?? 30 };
}

/** Live orders screen: everything still moving + what finished today. */
export async function getLiveOrders() {
  const sb = supabase();
  const since = new Date(Date.now() - 36 * 3600_000).toISOString();
  const [active, done, ctx] = await Promise.all([
    sb.from("orders").select(ORDER_SELECT).in("status", ACTIVE_STATUSES).order("created_at").limit(100),
    sb.from("orders").select(ORDER_SELECT).in("status", ["delivered", "cancelled"]).gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    cardContext(),
  ]);
  const today = istDateKey(new Date());
  return {
    active: unwrap(active, "Couldn't load orders.") as unknown as OrderRow[],
    done: (unwrap(done, "Couldn't load orders.") as unknown as OrderRow[]).filter((o) => istDateKey(o.created_at) === today),
    ...ctx,
  };
}

export async function getOrderDetail(id: string) {
  const sb = supabase();
  const [o, h, ctx] = await Promise.all([
    sb.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle(),
    sb.from("order_status_history").select("id, from_status, to_status, note, created_at").eq("order_id", id).order("created_at"),
    cardContext(),
  ]);
  return {
    order: unwrap(o, "Couldn't load the order.") as unknown as OrderRow | null,
    history: (unwrap(h, "Couldn't load the order history.") ?? []) as OrderHistoryEntry[],
    ...ctx,
  };
}

export const ORDER_RANGES = {
  today: { label: "Today", days: 0 },
  "7d": { label: "7 days", days: 6 },
  "30d": { label: "30 days", days: 29 },
  all: { label: "All", days: null },
} as const;
export type OrderRange = keyof typeof ORDER_RANGES;

/** All orders page: filter by date range, status, order number or mobile. */
export async function listOrders(f: { range: OrderRange; status: string; q: string; page: number; pageSize: number }) {
  let query = supabase()
    .from("orders")
    .select(SUMMARY_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((f.page - 1) * f.pageSize, f.page * f.pageSize - 1);
  const days = ORDER_RANGES[f.range].days;
  if (days !== null) query = query.gte("created_at", istDayStartISO(days));
  if (f.status) query = query.eq("status", f.status);
  const digits = f.q.replace(/\D/g, "");
  if (digits.length >= 10) query = query.eq("phone", digits.slice(-10));
  else if (digits) query = query.eq("order_no", Number(digits));
  const res = await query;
  return { rows: (unwrap(res, "Couldn't load orders.") ?? []) as OrderSummary[], count: res.count ?? 0 };
}

/** New orders waiting for the shop (drives the alarm and the red badge). */
export async function listNewOrderIds(): Promise<{ id: string; no: number }[]> {
  const { data } = await supabase().from("orders").select("id, order_no, payment_method, payment_status").eq("status", "new").order("created_at");
  return ((data ?? []) as Pick<OrderRow, "id" | "order_no" | "payment_method" | "payment_status">[])
    .filter((o) => !isAwaitingOnlinePayment(o))
    .map((o) => ({ id: o.id, no: o.order_no }));
}

export type LiveStatus = "connecting" | "live" | "offline";

/**
 * Instant updates when any order changes (Supabase Realtime).
 * Callers should still poll as a backup; realtime can drop on mobile data.
 */
export function subscribeToOrders(channel: string, onChange: () => void, onStatus?: (s: LiveStatus) => void): () => void {
  const sb = supabase();
  const ch = sb
    .channel(channel)
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => onChange())
    .subscribe((status) => onStatus?.(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" ? "offline" : "connecting"));
  return () => void sb.removeChannel(ch);
}

/**
 * Order actions. Each is one database function that checks the person's role
 * and the order's state, and records history. Never throws: returns { ok, message }.
 */
async function act(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { data, error } = await supabase().rpc(fn, args);
    const res = data as ActionResult | null;
    if (error || !res?.ok) return { ok: false, message: res?.message ?? "Couldn't update. Check your internet and try again." };
    return { ok: true };
  } catch {
    return { ok: false, message: "No internet connection. Try again." };
  }
}

export const orderActions = {
  /** Move to the next stage. `eta` (minutes) is set when confirming a new order. */
  advance: (orderId: string, to: OrderStatus, eta: number | null) => act("update_order_status", { p_order_id: orderId, p_to: to, p_eta_minutes: eta }),
  cancel: (orderId: string, reason: string) => act("update_order_status", { p_order_id: orderId, p_to: "cancelled", p_note: reason }),
  /** Item not in stock today: removed from the bill, total recalculated. */
  removeItem: (orderId: string, itemId: number) => act("mark_item_unavailable", { p_order_id: orderId, p_item_id: itemId }),
  markPaid: (orderId: string) => act("set_payment_status", { p_order_id: orderId, p_status: "paid" }),
};
