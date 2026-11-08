"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ORDER_RANGES, listOrders, type OrderRange } from "@/services/admin/orders";
import { formatPaise } from "@/lib/money";
import { orderLabel } from "@/config/site";
import { istDate, istTime } from "@/lib/time";
import { useAsync } from "@/hooks/useAsync";
import { Empty, ErrorBox, PageTitle, Spinner, STATUS, StatusPill } from "@/components/admin/AdminUI";

const PAGE = 40;
const RANGES = ORDER_RANGES;
type RangeKey = OrderRange;

function OrdersInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const range = (sp.get("range") as RangeKey) in RANGES ? (sp.get("range") as RangeKey) : "7d";
  const status = sp.get("status") && STATUS[sp.get("status")!] ? sp.get("status")! : "";
  const q = sp.get("q") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const [term, setTerm] = useState(q);

  const setParam = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ range, status, q, page: "1", ...patch });
    for (const [k, v] of [...p.entries()]) if (!v || (k === "page" && v === "1")) p.delete(k);
    router.replace(`/admin/orders?${p.toString()}`);
  };

  const { data, error, loading, reload } = useAsync(async () => {
    return listOrders({ range, status, q, page, pageSize: PAGE });
  }, [range, status, q, page]);

  const rows = data?.rows ?? [];
  const sales = rows.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total_paise, 0);
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE));

  return (
    <div>
      <PageTitle title="All orders" hue="orders" icon="orders" />

      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
        {(Object.keys(RANGES) as RangeKey[]).map((k) => (
          <button key={k} type="button" onClick={() => setParam({ range: k })} className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-bold ring-1 ${k === range ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-ink ring-line"}`}>
            {RANGES[k].label}
          </button>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        <button type="button" onClick={() => setParam({ status: "" })} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold ring-1 ${!status ? "bg-ink text-white ring-ink" : "bg-white ring-line"}`}>Any status</button>
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setParam({ status: k })} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold ring-1 ${k === status ? v.pill : "bg-white ring-line"}`}>
            {v.label}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setParam({ q: term.trim() }); }} className="mb-4 flex gap-2">
        <input className="field" inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Order number or customer mobile" />
        <button className="btn bg-indigo-600 text-white" type="submit">Find</button>
      </form>

      {data && (
        <p className="mb-2 text-[14px] text-muted">
          {data.count} orders. Sales on this page {formatPaise(sales)}, without cancelled.
        </p>
      )}

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox text={error} retry={reload} />
      ) : rows.length === 0 ? (
        <Empty icon="orders" title="No orders here" text="Try a longer date range or another status." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/order?id=${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-page">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{orderLabel(o.order_no)}, {o.customer_name}</span>
                  <span className="text-[13px] text-muted">
                    {istDate(o.created_at)}, {istTime(o.created_at)},{" "}
                    {o.payment_method === "cod" ? "cash" : "UPI"} {o.payment_status === "paid" ? "paid" : "not paid"}
                  </span>
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

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between">
          <button type="button" className="btn-plain" disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })}>Newer</button>
          <span className="text-[14px] text-muted">Page {page} of {pages}</span>
          <button type="button" className="btn-plain" disabled={page >= pages} onClick={() => setParam({ page: String(page + 1) })}>Older</button>
        </nav>
      )}
    </div>
  );
}

export default function AdminOrders() {
  return (
    <Suspense fallback={<Spinner />}>
      <OrdersInner />
    </Suspense>
  );
}
