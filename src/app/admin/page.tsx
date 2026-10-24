"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { formatPaise } from "@/lib/money";
import { formatTime, isOpenNow, istDayStartISO, istTime } from "@/lib/hours";
import { useAsync, must } from "@/lib/useAsync";
import { refreshStorefront, useTeam } from "@/components/admin/team";
import { ErrorBox, Spinner, StatusPill, Tile } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

type Recent = { id: string; order_no: number; customer_name: string; total_paise: number; status: string; created_at: string };

export default function Dashboard() {
  const { name } = useTeam();
  const toast = useToast();
  const [switching, setSwitching] = useState(false);

  const { data, error, loading, reload, setData } = useAsync(async () => {
    const sb = supabase();
    const [s, today, active, recent, low] = await Promise.all([
      sb.from("store_settings").select("accepting_orders, open_time, close_time, low_stock_threshold, delivery_fee_paise, free_delivery_threshold_paise, free_delivery_enabled, default_eta_minutes").eq("id", 1).single(),
      sb.from("orders").select("total_paise, status").gte("created_at", istDayStartISO()),
      sb.from("orders").select("id", { count: "exact", head: true }).in("status", ["new", "confirmed", "out_for_delivery"]),
      sb.from("orders").select("id, order_no, customer_name, total_paise, status, created_at").order("created_at", { ascending: false }).limit(6),
      sb.from("product_variants").select("id, stock_qty").eq("is_active", true),
    ]);
    const settings = must(s) as {
      accepting_orders: boolean; open_time: string; close_time: string; low_stock_threshold: number;
      delivery_fee_paise: number; free_delivery_threshold_paise: number; free_delivery_enabled: boolean; default_eta_minutes: number;
    };
    const t = (must(today) ?? []) as { total_paise: number; status: string }[];
    return {
      settings,
      todayCount: t.length,
      todaySales: t.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total_paise, 0),
      active: active.count ?? 0,
      recent: (must(recent) ?? []) as Recent[],
      lowStock: ((low.data ?? []) as { stock_qty: number }[]).filter((v) => v.stock_qty <= settings.low_stock_threshold).length,
    };
  });

  async function toggleOrders() {
    if (!data) return;
    const next = !data.settings.accepting_orders;
    setSwitching(true);
    const { error: e } = await supabase().from("store_settings").update({ accepting_orders: next }).eq("id", 1);
    setSwitching(false);
    if (e) return toast("Couldn't change. Try again.", "error");
    setData({ ...data, settings: { ...data.settings, accepting_orders: next } });
    toast(next ? "Online orders are on" : "Online orders are paused");
    void refreshStorefront();
  }

  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox text={error ?? "Couldn't load."} retry={reload} />;

  const s = data.settings;
  const openNow = isOpenNow(s);
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[15px] text-muted">{greet}{name && !name.includes("@") ? `, ${name}` : ""}</p>
        <h1 className="font-display text-[28px] font-extrabold leading-tight">Today at the shop</h1>
      </div>

      {/* Orders on/off: the most important switch */}
      <section className={`flex flex-wrap items-center gap-4 rounded-2xl p-4 ring-1 ${openNow ? "bg-leaf-700 text-white ring-leaf-800" : "bg-rose-50 text-rose-950 ring-rose-200"}`}>
        <span className={`flex size-12 items-center justify-center rounded-full ${openNow ? "bg-white/15" : "bg-rose-100"}`}>
          <Icon name="power" className="size-6" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-extrabold">{openNow ? "Taking orders now" : "Not taking orders"}</p>
          <p className={`text-[14px] ${openNow ? "text-white/80" : "text-rose-800"}`}>
            {!s.accepting_orders ? "You paused online orders." : `Shop hours ${formatTime(s.open_time)} to ${formatTime(s.close_time)}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleOrders}
          disabled={switching}
          className={`btn min-w-36 ${s.accepting_orders ? "bg-white text-rose-700 ring-1 ring-rose-200" : "bg-leaf-700 text-white"}`}
        >
          {switching ? "Saving…" : s.accepting_orders ? "Pause orders" : "Start orders"}
        </button>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile href="/staff" hue="live" icon="bell" value={String(data.active)} title="Active orders" note="New, packing, on the way" />
        <Tile href="/admin/orders?range=today" hue="orders" icon="orders" value={String(data.todayCount)} title="Orders today" />
        <Tile href="/admin/orders?range=today" hue="home" icon="rupee" value={formatPaise(data.todaySales)} title="Sales today" note="Without cancelled" />
        <Tile href="/admin/products?filter=low" hue="danger" icon="alert" value={String(data.lowStock)} title="Low stock" note={`${s.low_stock_threshold} or fewer left`} />
      </div>

      <section>
        <h2 className="mb-2 text-[17px] font-bold">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile href="/admin/products/new" hue="products" icon="plus" title="Add product" note="Photo, size, price" />
          <Tile href="/admin/categories" hue="categories" icon="tag" title="Categories" note="Shelves on the website" />
          <Tile href="/admin/settings" hue="settings" icon="settings" title="Timing & delivery" note={`₹${s.delivery_fee_paise / 100} fee, ${s.default_eta_minutes} min`} />
          <Tile href="/admin/pincodes" hue="pincodes" icon="pin" title="PIN codes" note="Where you deliver" />
        </div>
      </section>

      <section className="rounded-2xl bg-white ring-1 ring-line">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-[17px] font-bold">Latest orders</h2>
          <Link href="/admin/orders" className="text-[14px] font-bold text-indigo-700">See all</Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="px-4 py-6 text-[15px] text-muted">No orders yet. Share your store link on WhatsApp and Instagram to get the first one.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {data.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/order?id=${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-page">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold">VS-{o.order_no}, {o.customer_name}</span>
                    <span className="text-[13px] text-muted">{istTime(o.created_at)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[15px] font-extrabold">{formatPaise(o.total_paise)}</span>
                    <StatusPill status={o.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
