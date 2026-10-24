"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { formatPaise } from "@/lib/money";
import { istTime } from "@/lib/hours";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { STATUS, StatusPill } from "./ui";

export type OrderItem = { id: number; product_name: string; variant_label: string; qty: number; unit_price_paise: number; line_total_paise: number; is_unavailable: boolean };
export type OrderRow = {
  id: string;
  order_no: number;
  public_token: string;
  status: "new" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled";
  customer_name: string;
  phone: string;
  address_line: string;
  landmark: string | null;
  pincode: string;
  instructions: string | null;
  subtotal_paise: number;
  delivery_fee_paise: number;
  total_paise: number;
  payment_method: "cod" | "upi";
  payment_status: "unpaid" | "awaiting_verification" | "paid";
  upi_utr: string | null;
  eta_minutes: number | null;
  cancel_reason: string | null;
  created_at: string;
  confirmed_at: string | null;
  order_items: OrderItem[];
};

export const ORDER_SELECT =
  "id, order_no, public_token, status, customer_name, phone, address_line, landmark, pincode, instructions, subtotal_paise, delivery_fee_paise, total_paise, payment_method, payment_status, upi_utr, eta_minutes, cancel_reason, created_at, confirmed_at, order_items(id, product_name, variant_label, qty, unit_price_paise, line_total_paise, is_unavailable)";

const NEXT: Partial<Record<OrderRow["status"], { to: string; label: string; icon: string }>> = {
  new: { to: "confirmed", label: "Confirm order", icon: "check" },
  confirmed: { to: "out_for_delivery", label: "Send for delivery", icon: "truck" },
  out_for_delivery: { to: "delivered", label: "Mark delivered", icon: "check" },
};

const PAYMENT_LABEL = { unpaid: "Not collected", awaiting_verification: "Check UPI app", paid: "Paid" } as const;

function waMessage(o: OrderRow, storeName: string): string {
  const no = `VS-${o.order_no}`;
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const link = site ? `\nTrack your order: ${site}/order?t=${o.public_token}` : "";
  const items = o.order_items.filter((i) => !i.is_unavailable).map((i) => `${i.qty} x ${i.product_name} (${i.variant_label})`).join("\n");
  const missing = o.order_items.filter((i) => i.is_unavailable).map((i) => i.product_name);
  const missingLine = missing.length ? `\nSorry, not available today: ${missing.join(", ")}. Removed from your bill.` : "";
  if (o.status === "out_for_delivery") return `Hello ${o.customer_name}, your ${storeName} order ${no} is on the way. Amount: ${formatPaise(o.total_paise)}.${link}`;
  if (o.status === "new" || o.status === "confirmed")
    return `Hello ${o.customer_name}, your ${storeName} order ${no} is confirmed.${missingLine}\n${items}\nTotal: ${formatPaise(o.total_paise)}${o.eta_minutes ? `\nDelivery in about ${o.eta_minutes} minutes.` : ""}${link}`;
  return `Hello ${o.customer_name}, about your ${storeName} order ${no}:${link}`;
}

export function OrderCard({
  o,
  isOwner,
  storeName,
  defaultEta,
  onChanged,
  detailLink = false,
}: {
  o: OrderRow;
  isOwner: boolean;
  storeName: string;
  defaultEta: number;
  onChanged: () => void;
  detailLink?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [eta, setEta] = useState(o.eta_minutes ?? defaultEta);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const next = NEXT[o.status];
  const editable = o.status === "new" || o.status === "confirmed";
  const liveItems = o.order_items.filter((i) => !i.is_unavailable).length;

  async function call(key: string, fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(key);
    const { data, error } = await supabase().rpc(fn, args);
    setBusy(null);
    const res = data as { ok?: boolean; message?: string } | null;
    if (error || !res?.ok) {
      toast(res?.message ?? "Couldn't update. Check your internet and try again.", "error");
      return;
    }
    toast(ok);
    onChanged();
  }

  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address_line} ${o.pincode}`)}`;
  const wa = `https://wa.me/91${o.phone}?text=${encodeURIComponent(waMessage(o, storeName))}`;
  const accent =
    o.status === "new" ? "border-l-amber-500" : o.status === "confirmed" ? "border-l-blue-600" : o.status === "out_for_delivery" ? "border-l-violet-600" : o.status === "delivered" ? "border-l-emerald-600" : "border-l-rose-500";

  return (
    <article className={`overflow-hidden rounded-2xl border-l-[6px] bg-white ring-1 ring-line ${accent}`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <p className="font-display text-[22px] font-extrabold leading-none">
            VS-{o.order_no}
            {detailLink && (
              <Link href={`/admin/order?id=${o.id}`} className="ml-2 align-middle text-[13px] font-semibold text-indigo-700 underline">
                Details
              </Link>
            )}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}, {istTime(o.created_at)}
            {o.eta_minutes && o.status !== "delivered" && o.status !== "cancelled" ? `, deliver in ${o.eta_minutes} min` : ""}
          </p>
        </div>
        <StatusPill status={o.status} />
      </div>

      {/* Items: big and clear for packing */}
      <ul className="mx-4 mt-3 divide-y divide-line rounded-xl bg-page">
        {o.order_items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-3 py-2">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-[16px] font-extrabold ${i.is_unavailable ? "bg-neutral-200 text-neutral-500" : "bg-white text-ink ring-1 ring-line"}`}>
              {i.qty}
            </span>
            <span className={`min-w-0 flex-1 text-[15px] leading-snug ${i.is_unavailable ? "text-muted line-through" : "font-semibold"}`}>
              {i.product_name} <span className="font-normal text-muted">{i.variant_label}</span>
            </span>
            {editable && !i.is_unavailable && liveItems > 1 ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => call(`na-${i.id}`, "mark_item_unavailable", { p_order_id: o.id, p_item_id: i.id }, "Item removed, bill updated")}
                className="shrink-0 rounded-lg border border-line bg-white px-2 py-1 text-[12px] font-semibold text-muted"
              >
                {busy === `na-${i.id}` ? "…" : "Not available"}
              </button>
            ) : (
              <span className="shrink-0 text-[14px] text-muted">{formatPaise(i.line_total_paise)}</span>
            )}
          </li>
        ))}
      </ul>

      {/* Customer */}
      <div className="px-4 pt-3">
        <p className="text-[16px] font-bold">{o.customer_name}</p>
        <p className="text-[15px] leading-snug text-ink/90">
          {o.address_line}
          {o.landmark ? ` (${o.landmark})` : ""}, {o.pincode}
        </p>
        {o.instructions && <p className="mt-2 rounded-lg bg-haldi-100 px-3 py-2 text-[14px] font-semibold text-haldi-700">Note: {o.instructions}</p>}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={`tel:+91${o.phone}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-sky-50 text-[14px] font-bold text-sky-800 ring-1 ring-sky-200">
            <Icon name="phone" className="size-4" /> Call
          </a>
          <a href={wa} target="_blank" rel="noopener" className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-[14px] font-bold text-emerald-800 ring-1 ring-emerald-200">
            <Icon name="chat" className="size-4" /> WhatsApp
          </a>
          <a href={maps} target="_blank" rel="noopener" className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-[14px] font-bold text-slate-800 ring-1 ring-slate-200">
            <Icon name="pin" className="size-4" /> Map
          </a>
        </div>
      </div>

      {/* Money */}
      <div className="mx-4 mt-3 flex items-center justify-between gap-2 border-t border-dashed border-line pt-3">
        <div className="text-[13px] leading-tight text-muted">
          Items {formatPaise(o.subtotal_paise)}
          <br />
          Delivery {o.delivery_fee_paise ? formatPaise(o.delivery_fee_paise) : "free"}
        </div>
        <div className="text-right">
          <p className="font-display text-[24px] font-extrabold leading-none">{formatPaise(o.total_paise)}</p>
          <p className={`mt-1 text-[13px] font-bold ${o.payment_status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
            {o.payment_method === "cod" ? "Cash" : "UPI"}, {PAYMENT_LABEL[o.payment_status]}
          </p>
        </div>
      </div>
      {o.payment_method === "upi" && o.upi_utr && <p className="mx-4 mt-1 text-[13px] text-muted">Customer's UPI ref: <b className="text-ink">{o.upi_utr}</b></p>}
      {o.status === "cancelled" && o.cancel_reason && <p className="mx-4 mt-2 text-[14px] text-rose-700">Cancelled: {o.cancel_reason}</p>}

      {/* Actions */}
      <div className="space-y-2 p-4">
        {next && (
          <div className="flex gap-2">
            {o.status === "new" && (
              <select
                value={eta}
                onChange={(e) => setEta(Number(e.target.value))}
                className="h-12 w-[6.5rem] shrink-0 rounded-xl border border-line bg-white px-2 text-[15px] font-semibold"
                aria-label="Delivery time"
              >
                {[15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            )}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                call("next", "update_order_status", { p_order_id: o.id, p_to: next.to, p_eta_minutes: o.status === "new" ? eta : null }, `${STATUS[next.to].label}: VS-${o.order_no}`)
              }
              className={`btn flex-1 text-[16px] ${STATUS[next.to].button}`}
            >
              <Icon name={next.icon} className="size-5" strokeWidth={2.6} />
              {busy === "next" ? "Updating…" : next.label}
            </button>
          </div>
        )}

        {o.payment_method === "cod" && o.payment_status !== "paid" && (o.status === "out_for_delivery" || o.status === "delivered") && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => call("cash", "set_payment_status", { p_order_id: o.id, p_status: "paid" }, "Cash marked as collected")}
            className="btn w-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300"
          >
            <Icon name="rupee" className="size-5" /> {busy === "cash" ? "Saving…" : `Cash collected, ${formatPaise(o.total_paise)}`}
          </button>
        )}

        {isOwner && o.payment_method === "upi" && o.payment_status !== "paid" && o.status !== "cancelled" && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => call("upi", "set_payment_status", { p_order_id: o.id, p_status: "paid" }, "UPI payment confirmed")}
            className="btn w-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300"
          >
            <Icon name="check" className="size-5" /> {busy === "upi" ? "Saving…" : "I got the UPI payment"}
          </button>
        )}

        {isOwner && o.status !== "delivered" && o.status !== "cancelled" && (
          cancelling ? (
            <div className="space-y-2 rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
              <label htmlFor={`r-${o.id}`} className="text-[14px] font-bold text-rose-900">Why are you cancelling?</label>
              <input id={`r-${o.id}`} className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Customer asked, can't deliver…" />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-plain" onClick={() => setCancelling(false)}>Keep order</button>
                <button
                  type="button"
                  disabled={reason.trim().length < 3 || busy !== null}
                  onClick={() => call("cancel", "update_order_status", { p_order_id: o.id, p_to: "cancelled", p_note: reason.trim() }, "Order cancelled, stock restored")}
                  className="btn bg-rose-600 text-white"
                >
                  {busy === "cancel" ? "Cancelling…" : "Cancel order"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setCancelling(true)} className="w-full py-1 text-[14px] font-semibold text-rose-700">
              Cancel this order
            </button>
          )
        )}
      </div>
    </article>
  );
}
