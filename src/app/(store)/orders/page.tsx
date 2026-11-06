"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { formatPaise } from "@/lib/money";
import { useSavedOrders, type SavedOrder } from "@/lib/local";
import { useCart } from "@/components/store/cart";
import { StoreHeader } from "@/components/store/StoreHeader";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

const STATUS: Record<string, { text: string; cls: string }> = {
  new: { text: "Order received", cls: "bg-amber-100 text-amber-900" },
  confirmed: { text: "Packing", cls: "bg-sky-100 text-sky-900" },
  out_for_delivery: { text: "On the way", cls: "bg-violet-100 text-violet-900" },
  delivered: { text: "Delivered", cls: "bg-emerald-100 text-emerald-900" },
  cancelled: { text: "Cancelled", cls: "bg-neutral-200 text-neutral-700" },
};

type Live = { status: string; total_paise: number; payment_status: string; payment_method: string };

function OrderRow({ o, live }: { o: SavedOrder; live: Live | null | undefined }) {
  const { add } = useCart();
  const toast = useToast();
  const st = live ? STATUS[live.status] : null;
  const awaitingPay = live?.payment_method === "online" && live.payment_status !== "paid" && live.status !== "cancelled";
  const count = o.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <li className="rounded-[var(--radius-card)] bg-white p-4 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <div className="flex -space-x-3">
          {o.lines.slice(0, 3).map((l) => (
            <span key={l.variantId} className="size-11 overflow-hidden rounded-lg border-2 border-white bg-page shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.image && <img src={l.image} alt="" loading="lazy" decoding="async" className="size-full object-contain" />}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-extrabold">VS-{o.no}</p>
          <p className="text-[13px] text-muted">
            {new Date(o.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {count} item{count === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[16px] font-extrabold">{formatPaise(live?.total_paise ?? o.total)}</p>
          {live === undefined ? (
            <span className="skeleton mt-1 inline-block h-5 w-20 rounded-full" />
          ) : awaitingPay ? (
            <span className="mt-1 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[12px] font-bold text-rose-800">Payment pending</span>
          ) : st ? (
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[12px] font-bold ${st.cls}`}>{st.text}</span>
          ) : null}
        </div>
      </div>
      <p className="mt-2 line-clamp-1 text-[13px] text-muted">{o.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={`/order?t=${o.token}`} className="btn-plain py-2 text-[14px]">
          {awaitingPay ? "Pay now" : "Track order"}
        </Link>
        <button
          type="button"
          onClick={() => {
            o.lines.forEach((l) => add({ variantId: l.variantId, productId: l.productId, name: l.name, label: l.label, price: l.price, image: l.image, max: 20 }, l.qty));
            toast(`Added ${count} item${count === 1 ? "" : "s"} to your cart`);
          }}
          className="btn-brand py-2 text-[14px]"
        >
          <Icon name="cart" className="size-4" /> Order again
        </button>
      </div>
    </li>
  );
}

export default function OrdersPage() {
  const [orders, ready] = useSavedOrders();
  const [live, setLive] = useState<Record<string, Live | null>>({});

  useEffect(() => {
    if (!ready || !orders.length) return;
    const sb = supabase();
    orders.slice(0, 15).forEach(async (o) => {
      const { data } = await sb.rpc("get_order_by_token", { p_token: o.token });
      setLive((m) => ({ ...m, [o.token]: (data as Live | null) ?? null }));
    });
  }, [ready, orders]);

  return (
    <>
      <StoreHeader compact />
      <main className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="font-display text-[26px] font-extrabold">My orders</h1>
          <Link href="/favourites" className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[14px] font-bold text-rose-700 ring-1 ring-rose-100">
            <Icon name="heart" className="size-4" fill="currentColor" /> Favourites
          </Link>
        </div>
        {!ready ? (
          <ul className="space-y-3">{[0, 1].map((k) => <li key={k} className="skeleton h-36 rounded-[var(--radius-card)]" />)}</ul>
        ) : orders.length === 0 ? (
          <div className="rounded-[var(--radius-card)] bg-white p-6 text-center ring-1 ring-line">
            <Icon name="orders" className="mx-auto size-12 text-brand-200" />
            <p className="mt-2 text-[17px] font-bold">No orders yet</p>
            <p className="mt-1 text-[15px] text-muted">Orders you place from this phone show here, so you can track them and order again in one tap.</p>
            <Link href="/" className="btn-brand mt-4">Start shopping</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => <OrderRow key={o.token} o={o} live={o.token in live ? live[o.token] : undefined} />)}
          </ul>
        )}
        <p className="mt-4 text-center text-[13px] text-muted">Saved on this phone only. Ordered from another phone? Use the link in your order email or SMS.</p>
      </main>
    </>
  );
}
