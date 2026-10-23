import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { getSettings, whatsappLink } from "@/lib/store";
import { AutoRefresh, UtrForm } from "@/components/store/OrderClient";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

type OrderView = {
  order_no: number;
  status: "new" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled";
  created_at: string;
  confirmed_at: string | null;
  eta_minutes: number | null;
  payment_method: "cod" | "upi";
  payment_status: "unpaid" | "awaiting_verification" | "paid";
  subtotal_paise: number;
  delivery_fee_paise: number;
  total_paise: number;
  customer_first_name: string;
  items: { product_name: string; variant_label: string; qty: number; line_total_paise: number; is_unavailable: boolean }[];
};

const STEPS = [
  { key: "new", label: "Order received" },
  { key: "confirmed", label: "Confirmed & packing" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

function istTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { token } = await params;
  const { new: isNew } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const supabase = await createClient();
  const [{ data }, s, { data: upi }] = await Promise.all([
    supabase.rpc("get_order_by_token", { p_token: token }),
    getSettings(),
    supabase.from("store_settings").select("upi_id, upi_payee_name").eq("id", 1).maybeSingle(),
  ]);
  if (!data) notFound();
  const o = data as OrderView;
  const orderNo = `VS-${o.order_no}`;
  const stepIndex = STEPS.findIndex((x) => x.key === o.status);
  const moving = o.status !== "delivered" && o.status !== "cancelled";

  // UPI QR with the exact amount and order number pre-filled.
  let qr: string | null = null;
  let upiLink: string | null = null;
  const needsUpi = o.payment_method === "upi" && o.payment_status !== "paid" && o.status !== "cancelled";
  if (needsUpi && upi?.upi_id) {
    const upiParams = new URLSearchParams({
      pa: upi.upi_id as string,
      pn: (upi.upi_payee_name as string | null) ?? s?.store_name ?? "Vaishnavi Store",
      am: (o.total_paise / 100).toFixed(2),
      cu: "INR",
      tn: orderNo,
    });
    upiLink = `upi://pay?${upiParams.toString().replace(/\+/g, "%20")}`;
    qr = await QRCode.toDataURL(upiLink, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  }

  const summary = o.items
    .filter((i) => !i.is_unavailable)
    .map((i) => `${i.qty} x ${i.product_name} (${i.variant_label})`)
    .join("\n");
  const wa = whatsappLink(s?.whatsapp_number, `Hello, about my order ${orderNo} (${formatPaise(o.total_paise)}):\n${summary}`);

  return (
    <div className="space-y-4">
      <AutoRefresh active={moving} />

      <section className={`rounded-xl p-4 text-white ${o.status === "cancelled" ? "bg-neutral-600" : "bg-brand-700"}`}>
        {isNew && o.status === "new" && <p className="text-sm text-white/85">Thank you, {o.customer_first_name}!</p>}
        <p className="text-xl font-bold">
          {o.status === "cancelled" ? "Order cancelled" : o.status === "delivered" ? "Delivered" : "Order placed"}
        </p>
        <p className="text-sm text-white/85">Order {orderNo} · placed at {istTime(o.created_at)}</p>
        {moving && o.eta_minutes && (
          <p className="mt-2 text-sm">
            Expected in about <b>{o.eta_minutes} minutes</b>
            {o.confirmed_at ? ` from ${istTime(o.confirmed_at)}` : " after the store confirms"}.
          </p>
        )}
      </section>

      {o.status !== "cancelled" && (
        <ol className="card space-y-2">
          {STEPS.map((step, i) => (
            <li key={step.key} className="flex items-center gap-3 text-sm">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${i <= stepIndex ? "bg-brand-600 text-white" : "bg-neutral-200 text-neutral-500"}`}
                aria-hidden
              >
                {i < stepIndex || o.status === "delivered" ? "✓" : i + 1}
              </span>
              <span className={i <= stepIndex ? "font-medium" : "text-neutral-500"}>{step.label}</span>
            </li>
          ))}
        </ol>
      )}

      {needsUpi && (
        <section className="card space-y-3 text-center">
          <h2 className="font-semibold">Pay {formatPaise(o.total_paise)} with UPI</h2>
          {qr ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`UPI QR code for ${formatPaise(o.total_paise)}`} className="mx-auto size-56" />
              <a href={upiLink!} className="btn-primary w-full">Pay with GPay / PhonePe / Paytm</a>
              <p className="text-xs text-neutral-500">Amount and order number are filled in. Scan from another phone, or tap the button on this phone.</p>
            </>
          ) : (
            <p className="text-sm text-neutral-600">UPI details are not set up. Please pay cash on delivery or contact the store.</p>
          )}
          {o.payment_status === "awaiting_verification" && (
            <p className="text-xs text-neutral-500">Status: waiting for the store to confirm your payment.</p>
          )}
          <div className="text-left">
            <UtrForm token={token} existing={null} />
          </div>
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold">Items</h2>
        <ul className="space-y-1 text-sm">
          {o.items.map((i, idx) => (
            <li key={idx} className={`flex justify-between gap-2 ${i.is_unavailable ? "text-neutral-400 line-through" : ""}`}>
              <span className="min-w-0">{i.qty} × {i.product_name} <span className="text-neutral-500">({i.variant_label})</span></span>
              <span className="shrink-0">{formatPaise(i.line_total_paise)}</span>
            </li>
          ))}
        </ul>
        {o.items.some((i) => i.is_unavailable) && (
          <p className="text-xs text-amber-800">Crossed-out items were not available and have been removed from your bill.</p>
        )}
        <dl className="space-y-1 border-t border-neutral-200 pt-2 text-sm">
          <div className="flex justify-between"><dt>Items</dt><dd>{formatPaise(o.subtotal_paise)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{o.delivery_fee_paise === 0 ? "FREE" : formatPaise(o.delivery_fee_paise)}</dd></div>
          <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatPaise(o.total_paise)}</dd></div>
          <div className="flex justify-between text-neutral-600">
            <dt>Payment</dt>
            <dd>
              {o.payment_method === "cod" ? "Cash on Delivery" : "UPI"} ·{" "}
              {o.payment_status === "paid" ? "Paid" : o.payment_status === "awaiting_verification" ? "Being checked" : "To pay on delivery"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card space-y-2 text-sm">
        <p>Save this page to check your order status. Questions or changes? Contact the store:</p>
        <div className="flex gap-2">
          {wa && <a className="btn-primary flex-1" href={wa} rel="noopener">WhatsApp store</a>}
          {s?.phone_primary && <a className="btn-ghost flex-1" href={`tel:+91${s.phone_primary}`}>Call store</a>}
        </div>
      </section>

      <Link href="/" className="block text-center text-sm text-brand-700">Continue shopping</Link>
    </div>
  );
}
