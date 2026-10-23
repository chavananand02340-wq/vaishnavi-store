import Link from "next/link";
import { formatPaise } from "@/lib/money";
import { SubmitButton } from "@/components/SubmitButton";
import {
  advanceOrder,
  cancelOrder,
  markCashCollected,
  markItemUnavailable,
  setPayment,
} from "@/app/staff/actions";

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

export const STATUS_LABEL: Record<OrderRow["status"], string> = {
  new: "New",
  confirmed: "Confirmed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<OrderRow["status"], string> = {
  new: "bg-amber-100 text-amber-900",
  confirmed: "bg-sky-100 text-sky-900",
  out_for_delivery: "bg-violet-100 text-violet-900",
  delivered: "bg-brand-50 text-brand-800",
  cancelled: "bg-neutral-200 text-neutral-700",
};

const NEXT: Partial<Record<OrderRow["status"], { to: string; label: string }>> = {
  new: { to: "confirmed", label: "Confirm order" },
  confirmed: { to: "out_for_delivery", label: "Out for delivery" },
  out_for_delivery: { to: "delivered", label: "Mark delivered" },
};

export const PAYMENT_LABEL: Record<OrderRow["payment_status"], string> = {
  unpaid: "Not collected",
  awaiting_verification: "Owner to verify",
  paid: "Paid",
};

export function istTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

function customerMessage(o: OrderRow, storeName: string, siteUrl: string | null): string {
  const no = `VS-${o.order_no}`;
  const link = siteUrl ? `\nTrack: ${siteUrl}/order/${o.public_token}` : "";
  const items = o.order_items.filter((i) => !i.is_unavailable).map((i) => `${i.qty} x ${i.product_name} (${i.variant_label})`).join("\n");
  const missing = o.order_items.filter((i) => i.is_unavailable).map((i) => i.product_name);
  const missingLine = missing.length ? `\nSorry, not available today: ${missing.join(", ")}. Removed from your bill.` : "";
  switch (o.status) {
    case "new":
    case "confirmed":
      return `Hello ${o.customer_name}, your ${storeName} order ${no} is confirmed.${missingLine}\n${items}\nTotal: ${formatPaise(o.total_paise)}${o.eta_minutes ? `\nDelivery in about ${o.eta_minutes} minutes.` : ""}${link}`;
    case "out_for_delivery":
      return `Hello ${o.customer_name}, your order ${no} is out for delivery. Amount: ${formatPaise(o.total_paise)}.${link}`;
    default:
      return `Hello ${o.customer_name}, about your ${storeName} order ${no}:${link}`;
  }
}

export function OrderCard({
  o,
  isOwner,
  returnTo,
  storeName,
  siteUrl,
  defaultEta,
  showDetailLink = false,
}: {
  o: OrderRow;
  isOwner: boolean;
  returnTo: string;
  storeName: string;
  siteUrl: string | null;
  defaultEta: number;
  showDetailLink?: boolean;
}) {
  const next = NEXT[o.status];
  const editableItems = o.status === "new" || o.status === "confirmed";
  const liveItems = o.order_items.filter((i) => !i.is_unavailable).length;
  const wa = `https://wa.me/91${o.phone}?text=${encodeURIComponent(customerMessage(o, storeName, siteUrl))}`;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address_line} ${o.pincode}`)}`;
  const hidden = (
    <>
      <input type="hidden" name="order_id" value={o.id} />
      <input type="hidden" name="return_to" value={returnTo} />
    </>
  );

  return (
    <article className={`card space-y-3 ${o.status === "new" ? "ring-2 ring-amber-400" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">
            VS-{o.order_no}
            {showDetailLink && (
              <Link href={`/admin/orders/${o.id}`} className="ml-2 text-xs font-normal text-brand-700 underline">details</Link>
            )}
          </p>
          <p className="text-xs text-neutral-500">
            {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} · {istTime(o.created_at)}
            {o.eta_minutes && o.status !== "delivered" && o.status !== "cancelled" ? ` · ETA ${o.eta_minutes} min` : ""}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
      </div>

      <ul className="divide-y divide-neutral-100 text-sm">
        {o.order_items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className={i.is_unavailable ? "text-neutral-400 line-through" : ""}>
              <b>{i.qty} ×</b> {i.product_name} <span className="text-neutral-500">({i.variant_label})</span>
            </span>
            {editableItems && !i.is_unavailable && liveItems > 1 ? (
              <form action={markItemUnavailable}>
                {hidden}
                <input type="hidden" name="item_id" value={i.id} />
                <button type="submit" className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700">Not available</button>
              </form>
            ) : (
              <span className="shrink-0 text-xs text-neutral-500">{formatPaise(i.line_total_paise)}</span>
            )}
          </li>
        ))}
      </ul>

      <div className="rounded-lg bg-neutral-50 p-3 text-sm">
        <p className="font-semibold">{o.customer_name} · {o.phone}</p>
        <p>{o.address_line}{o.landmark ? `, near ${o.landmark}` : ""} – {o.pincode}</p>
        {o.instructions && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-900">Note: {o.instructions}</p>}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <a className="btn-ghost px-2" href={`tel:+91${o.phone}`}>Call</a>
          <a className="btn-ghost px-2" href={wa} rel="noopener" target="_blank">WhatsApp</a>
          <a className="btn-ghost px-2" href={maps} rel="noopener" target="_blank">Map</a>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          Items {formatPaise(o.subtotal_paise)} + delivery {o.delivery_fee_paise ? formatPaise(o.delivery_fee_paise) : "free"} ={" "}
          <b className="text-base">{formatPaise(o.total_paise)}</b>
        </span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${o.payment_status === "paid" ? "bg-brand-50 text-brand-800" : "bg-amber-50 text-amber-900"}`}>
          {o.payment_method === "cod" ? "COD" : "UPI"} · {PAYMENT_LABEL[o.payment_status]}
        </span>
      </div>
      {o.payment_method === "upi" && o.upi_utr && <p className="text-xs text-neutral-600">Customer UTR: <b>{o.upi_utr}</b></p>}
      {o.status === "cancelled" && o.cancel_reason && <p className="text-xs text-neutral-600">Cancelled: {o.cancel_reason}</p>}

      <div className="space-y-2">
        {next && (
          <form action={advanceOrder} className="flex gap-2">
            {hidden}
            <input type="hidden" name="to" value={next.to} />
            {o.status === "new" && (
              <select name="eta" defaultValue={String(o.eta_minutes ?? defaultEta)} className="field w-28 shrink-0" aria-label="Delivery time">
                {[15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            )}
            <SubmitButton className="btn-primary flex-1" pendingText="Updating…">{next.label}</SubmitButton>
          </form>
        )}
        {o.payment_method === "cod" && o.payment_status !== "paid" && (o.status === "out_for_delivery" || o.status === "delivered") && (
          <form action={markCashCollected}>
            {hidden}
            <SubmitButton className="btn-ghost w-full" pendingText="Updating…">Cash collected ✓</SubmitButton>
          </form>
        )}

        {isOwner && o.payment_method === "upi" && o.payment_status !== "paid" && o.status !== "cancelled" && (
          <form action={setPayment}>
            {hidden}
            <input type="hidden" name="status" value="paid" />
            <SubmitButton className="btn-ghost w-full" pendingText="Updating…">UPI payment received ✓ (checked in my UPI app)</SubmitButton>
          </form>
        )}

        {isOwner && o.status !== "delivered" && o.status !== "cancelled" && (
          <details>
            <summary className="cursor-pointer text-sm text-red-700">Cancel order…</summary>
            <form action={cancelOrder} className="mt-2 space-y-2">
              {hidden}
              <input className="field" name="reason" placeholder="Reason (customer asked, not deliverable…)" minLength={3} maxLength={200} required />
              <SubmitButton className="btn-danger w-full" pendingText="Cancelling…">Cancel order & restore stock</SubmitButton>
            </form>
          </details>
        )}
      </div>
    </article>
  );
}
