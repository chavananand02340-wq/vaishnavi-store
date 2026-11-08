"use client";

import Link from "next/link";
import { getDashboard, setAcceptingOrders } from "@/services/admin/settings";
import { formatPaise } from "@/lib/money";
import { orderLabel } from "@/config/site";
import { formatTime, isOpenNow, istHour, istTime } from "@/lib/time";
import { useAsync } from "@/hooks/useAsync";
import { useAction } from "@/hooks/useAction";
import { useTeam } from "@/state/team";
import { ErrorBox, Spinner, StatusPill, Tile } from "@/components/admin/AdminUI";
import { Icon } from "@/components/ui/Icon";

export default function Dashboard() {
  const { name } = useTeam();
  const { run, busy } = useAction();
  const switching = busy === "orders";

  const { data, error, loading, reload, setData } = useAsync(getDashboard);

  async function toggleOrders() {
    if (!data) return;
    const next = !data.settings.accepting_orders;
    const done = await run("orders", () => setAcceptingOrders(next), {
      success: next ? "Online orders are on" : "Online orders are paused",
      failure: "Couldn't change. Try again.",
      refreshStore: true,
    });
    if (done) setData({ ...data, settings: { ...data.settings, accepting_orders: next } });
  }

  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox text={error ?? "Couldn't load."} retry={reload} />;

  const s = data.settings;
  const openNow = isOpenNow(s);
  const hour = istHour();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[15px] text-muted">{greet}{name && !name.includes("@") ? `, ${name}` : ""}</p>
        <h1 className="font-display text-[28px] font-extrabold leading-tight">Today at the shop</h1>
      </div>

      {/* Orders on/off: the most important switch */}
      <section className={`flex flex-wrap items-center gap-4 rounded-2xl p-4 ring-1 ${openNow ? "bg-brand-700 text-white ring-brand-800" : "bg-rose-50 text-rose-950 ring-rose-200"}`}>
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
          className={`btn w-full sm:w-auto sm:min-w-36 ${s.accepting_orders ? "bg-white text-rose-700 ring-1 ring-rose-200" : "bg-brand-700 text-white"}`}
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
          <Tile href="/admin/coupons" hue="coupons" icon="percent" title="Coupons" note="Discount codes" />
          <Tile href="/admin/banners" hue="banners" icon="gift" title="Banners" note="Top offer + sliding banners" />
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
                    <span className="block text-[15px] font-bold">{orderLabel(o.order_no)}, {o.customer_name}</span>
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
