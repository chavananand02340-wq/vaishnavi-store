import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { setAcceptingOrders } from "./actions";

function istDayStartISO() {
  // Midnight today in India (UTC+05:30), as an ISO timestamp.
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60_000);
  const midnightIstAsUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000;
  return new Date(midnightIstAsUtc).toISOString();
}

export default async function AdminHome() {
  const supabase = await createClient();
  const dayStart = istDayStartISO();

  const [settingsRes, openRes, todayRes, activeRes] = await Promise.all([
    supabase
      .from("store_settings")
      .select("accepting_orders, open_time, close_time, delivery_fee_paise, free_delivery_enabled, free_delivery_threshold_paise, cod_enabled, default_eta_minutes, low_stock_threshold")
      .eq("id", 1)
      .single(),
    supabase.rpc("store_is_open"),
    supabase.from("orders").select("total_paise, status").gte("created_at", dayStart),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["new", "confirmed", "out_for_delivery"]),
  ]);

  const s = settingsRes.data;
  const today = todayRes.data ?? [];
  const todaySales = today.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.total_paise, 0);

  const lowStock = s
    ? await supabase
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .lte("stock_qty", s.low_stock_threshold)
    : null;

  return (
    <div className="space-y-4">
      <section className="card flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Online orders</p>
          <p className={`text-lg font-semibold ${openRes.data ? "text-brand-700" : "text-red-700"}`}>
            {openRes.data ? "Open — taking orders" : "Closed — not taking orders"}
          </p>
          {s && (
            <p className="text-xs text-neutral-500">
              Hours {s.open_time.slice(0, 5)}–{s.close_time.slice(0, 5)} · switch is {s.accepting_orders ? "ON" : "OFF"}
            </p>
          )}
        </div>
        {s && (
          <form action={setAcceptingOrders}>
            <input type="hidden" name="value" value={s.accepting_orders ? "false" : "true"} />
            <button className={s.accepting_orders ? "btn-danger" : "btn-primary"} type="submit">
              {s.accepting_orders ? "Stop orders" : "Start orders"}
            </button>
          </form>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Today's orders" value={String(today.length)} />
        <Stat label="Today's sales" value={formatPaise(todaySales)} />
        <Stat label="Active orders" value={String(activeRes.count ?? 0)} href="/staff" />
        <Stat label="Low stock items" value={String(lowStock?.count ?? 0)} />
      </section>

      {s && (
        <section className="card text-sm">
          <h2 className="mb-2 font-semibold">Current delivery rules</h2>
          <ul className="space-y-1 text-neutral-700">
            <li>Delivery fee: {formatPaise(s.delivery_fee_paise)}</li>
            <li>
              Free delivery:{" "}
              {s.free_delivery_enabled ? `on orders of ${formatPaise(s.free_delivery_threshold_paise)} or more` : "off (fee always applies)"}
            </li>
            <li>Cash on Delivery: {s.cod_enabled ? "available on every order" : "turned off"}</li>
            <li>Expected delivery: about {s.default_eta_minutes} minutes</li>
          </ul>
          <Link href="/admin/settings" className="mt-3 inline-block font-medium text-brand-700 underline">
            Change settings
          </Link>
        </section>
      )}

      <p className="text-xs text-neutral-500">Products and order management arrive in the next phases.</p>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <div className="card h-full">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
