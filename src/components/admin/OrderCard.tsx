"use client";

import Link from "next/link";
import { useState } from "react";
import { orderActions } from "@/services/admin/orders";
import { orderLabel } from "@/config/site";
import type { ActionResult, OrderRow } from "@/types/order";
import { formatPaise } from "@/lib/money";
import { istDate, istTime } from "@/lib/time";
import { Icon } from "@/components/ui/Icon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { requestOrderEmail } from "@/services/checkout";
import { useToast } from "@/components/ui/Toast";
import { STATUS, StatusPill } from "@/components/admin/AdminUI";

const NEXT: Partial<Record<OrderRow["status"], { to: OrderRow["status"]; label: string; icon: string }>> = {
  new: { to: "confirmed", label: "Confirm order", icon: "check" },
  confirmed: { to: "out_for_delivery", label: "Send for delivery", icon: "truck" },
  out_for_delivery: { to: "delivered", label: "Mark delivered", icon: "check" },
};

const PAYMENT_LABEL = { unpaid: "Not collected", awaiting_verification: "Check UPI app", paid: "Paid" } as const;

function waMessage(o: OrderRow, storeName: string): string {
  const no = orderLabel(o.order_no);
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
  const [armed, setArmed] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const next = NEXT[o.status];
  const editable = o.status === "new" || o.status === "confirmed";
  const liveItems = o.order_items.filter((i) => !i.is_unavailable).length;

  /** Runs one order action with a busy state and a toast. */
  async function call(key: string, action: () => Promise<ActionResult>, ok: string, after?: () => void) {
    setBusy(key);
    const res = await action();
    setBusy(null);
    if (!res.ok) return toast(res.message ?? "Couldn't update. Check your internet and try again.", "error");
    toast(ok);
    after?.();
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
            {orderLabel(o.order_no)}
            {detailLink && (
              <Link href={`/admin/order?id=${o.id}`} className="ml-2 align-middle text-[13px] font-semibold text-indigo-700 underline">
                Details
              </Link>
            )}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {istDate(o.created_at)}, {istTime(o.created_at)}
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
            <span className="shrink-0 text-[14px] text-muted">{i.is_unavailable ? "Removed" : formatPaise(i.line_total_paise)}</span>
            {editable && !i.is_unavailable && liveItems > 1 && (
              <button
                type="button"
                disabled={busy !== null}
                aria-label={`Remove ${i.product_name} from this order`}
                onClick={() => {
                  if (armed !== i.id) {
                    setArmed(i.id);
                    return;
                  }
                  setArmed(null);
                  call(`na-${i.id}`, () => orderActions.removeItem(o.id, i.id), "Item removed, bill updated");
                }}
                className={`shrink-0 rounded-lg px-2 py-1 text-[12px] font-bold ${armed === i.id ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}
              >
                {busy === `na-${i.id}` ? "…" : armed === i.id ? "Sure? Remove" : "Remove"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && liveItems > 1 && (
        <p className="mx-4 mt-1 text-[12px] text-muted">Item not on the shelf? Tap Remove. The bill updates on its own.</p>
      )}

      {/* Customer */}
      <div className="px-4 pt-3">
        <p className="text-[16px] font-bold">{o.customer_name}</p>
        <p className="text-[15px] leading-snug text-ink/90">
          {o.address_line}
          {o.landmark ? ` (${o.landmark})` : ""}, {o.pincode}
        </p>
        {o.delivery_lat != null && (
          <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-rose-700">
            <Icon name="pin" className="size-3.5" /> Customer shared live location{o.location_accuracy_m ? ` (±${o.location_accuracy_m} m)` : ""}
          </p>
        )}
        {o.instructions && <p className="mt-2 rounded-lg bg-haldi-100 px-3 py-2 text-[14px] font-semibold text-haldi-700">Note: {o.instructions}</p>}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={`tel:+91${o.phone}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-sky-50 text-[14px] font-bold text-sky-800 ring-1 ring-sky-200">
            <Icon name="phone" className="size-4" /> Call
          </a>
          <a href={wa} target="_blank" rel="noopener" className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#25d366] text-[14px] font-bold text-[#073b20]">
            <WhatsAppIcon className="size-4" /> WhatsApp
          </a>
          <a
            href={o.delivery_lat != null && o.delivery_lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${o.delivery_lat},${o.delivery_lng}` : maps}
            target="_blank"
            rel="noopener"
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold ring-1 ${o.delivery_lat != null ? "bg-rose-600 text-white ring-rose-600" : "bg-slate-100 text-slate-800 ring-slate-200"}`}
          >
            <Icon name="pin" className="size-4" /> {o.delivery_lat != null ? "Exact spot" : "Map"}
          </a>
        </div>
      </div>

      {/* Money */}
      <div className="mx-4 mt-3 flex items-center justify-between gap-2 border-t border-dashed border-line pt-3">
        <div className="text-[13px] leading-tight text-muted">
          Items {formatPaise(o.subtotal_paise)}
          <br />
          Delivery {o.delivery_fee_paise ? formatPaise(o.delivery_fee_paise) : "free"}
          {o.discount_paise > 0 && (
            <>
              <br />
              <span className="font-bold text-emerald-700">Coupon {o.coupon_code} −{formatPaise(o.discount_paise)}</span>
            </>
          )}
        </div>
        <div className="text-right">
          <p className="font-display text-[24px] font-extrabold leading-none">{formatPaise(o.total_paise)}</p>
          <p className={`mt-1 text-[13px] font-bold ${o.payment_status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
            {o.payment_method === "cod" ? "Cash" : o.payment_method === "online" ? "Online" : "UPI"}, {o.payment_method === "online" && o.payment_status !== "paid" ? "Not paid yet" : PAYMENT_LABEL[o.payment_status]}
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
                call("next", () => orderActions.advance(o.id, next.to, o.status === "new" ? eta : null), `${STATUS[next.to].label}: ${orderLabel(o.order_no)}`, () => {
                  // Accepting the order sends the customer the "we're packing" email.
                  if (next.to === "confirmed") requestOrderEmail(o.public_token, "packing");
                })
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
            onClick={() => call("cash", () => orderActions.markPaid(o.id), "Cash marked as collected")}
            className="btn w-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300"
          >
            <Icon name="rupee" className="size-5" /> {busy === "cash" ? "Saving…" : `Cash collected, ${formatPaise(o.total_paise)}`}
          </button>
        )}

        {isOwner && o.payment_method === "upi" && o.payment_status !== "paid" && o.status !== "cancelled" && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => call("upi", () => orderActions.markPaid(o.id), "UPI payment confirmed")}
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
                  onClick={() => call("cancel", () => orderActions.cancel(o.id, reason.trim()), "Order cancelled, stock restored")}
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
