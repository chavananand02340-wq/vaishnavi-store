import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { PAYMENT_LABEL, STATUS_LABEL, istTime, type OrderRow } from "@/components/orders/OrderCard";

const PAGE = 40;
const RANGES: Record<string, number | null> = { today: 1, "7d": 7, "30d": 30, all: null };

function istMidnightDaysAgo(days: number) {
  const now = new Date(Date.now() + 330 * 60_000);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 330 * 60_000;
  return new Date(midnight - (days - 1) * 86400_000).toISOString();
}

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; range?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range && sp.range in RANGES ? sp.range : "7d";
  const status = sp.status && sp.status in STATUS_LABEL ? sp.status : "";
  const q = (sp.q ?? "").replace(/\D/g, "").slice(0, 10);
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, order_no, status, customer_name, phone, total_paise, payment_method, payment_status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  const days = RANGES[range];
  if (days) query = query.gte("created_at", istMidnightDaysAgo(days));
  if (status) query = query.eq("status", status);
  if (q.length === 10) query = query.eq("phone", q);
  else if (q) query = query.eq("order_no", Number(q));

  const { data, count } = await query;
  const orders = (data ?? []) as unknown as OrderRow[];
  const sales = orders.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total_paise, 0);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const link = (p: number) => `/admin/orders?${new URLSearchParams({ range, status, q, page: String(p) }).toString()}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">All orders</h1>
      <form className="card grid grid-cols-2 gap-2 sm:grid-cols-4" action="/admin/orders">
        <select className="field" name="range" defaultValue={range} aria-label="Date range">
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <select className="field" name="status" defaultValue={status} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="field col-span-2" name="q" defaultValue={sp.q ?? ""} inputMode="numeric" placeholder="Order no. or 10-digit phone" />
        <button className="btn-ghost col-span-2 sm:col-span-4" type="submit">Show</button>
      </form>

      <p className="text-sm text-neutral-600">
        {count ?? 0} orders · this page {formatPaise(sales)} (excluding cancelled)
      </p>

      <ul className="divide-y divide-neutral-100 rounded-xl bg-white ring-1 ring-neutral-200">
        {orders.length === 0 && <li className="p-4 text-sm text-neutral-600">No orders found.</li>}
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-semibold">VS-{o.order_no} · {o.customer_name}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} {istTime(o.created_at)} · {o.payment_method.toUpperCase()} {PAYMENT_LABEL[o.payment_status]}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatPaise(o.total_paise)}</p>
                <p className="text-xs text-neutral-500">{STATUS_LABEL[o.status]}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          {page > 1 ? <Link className="btn-ghost" href={link(page - 1)}>‹ Newer</Link> : <span />}
          <span>Page {page} of {pages}</span>
          {page < pages ? <Link className="btn-ghost" href={link(page + 1)}>Older ›</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
