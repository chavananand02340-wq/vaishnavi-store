"use client";

import { supabase } from "@/lib/supabase/browser";
import { istDateKey } from "@/lib/hours";
import { useAsync, must } from "@/lib/useAsync";
import { useTeam } from "@/components/admin/team";
import { OrderAlerts } from "@/components/admin/OrderAlerts";
import { ORDER_SELECT, OrderCard, type OrderRow } from "@/components/admin/OrderCard";
import { Empty, ErrorBox, Spinner, STATUS } from "@/components/admin/ui";

export default function LiveOrders() {
  const { role } = useTeam();
  const { data, error, loading, reload } = useAsync(async () => {
    const sb = supabase();
    const since = new Date(Date.now() - 36 * 3600_000).toISOString();
    const [active, done, s] = await Promise.all([
      sb.from("orders").select(ORDER_SELECT).in("status", ["new", "confirmed", "out_for_delivery"]).order("created_at").limit(100),
      sb.from("orders").select(ORDER_SELECT).in("status", ["delivered", "cancelled"]).gte("created_at", since).order("created_at", { ascending: false }).limit(50),
      sb.from("store_settings").select("store_name, default_eta_minutes").eq("id", 1).single(),
    ]);
    return {
      active: must(active) as unknown as OrderRow[],
      done: (must(done) as unknown as OrderRow[]).filter((o) => istDateKey(o.created_at) === istDateKey(new Date())),
      storeName: (s.data?.store_name as string) ?? "Vaishnavi Store",
      eta: (s.data?.default_eta_minutes as number) ?? 30,
    };
  });

  const active = data?.active ?? [];
  const fresh = active.filter((o) => o.status === "new");
  const groups = [
    { key: "new", title: "New, confirm these", list: fresh },
    { key: "confirmed", title: "Packing", list: active.filter((o) => o.status === "confirmed") },
    { key: "out_for_delivery", title: "On the way", list: active.filter((o) => o.status === "out_for_delivery") },
  ];
  const common = { isOwner: role === "owner", storeName: data?.storeName ?? "", defaultEta: data?.eta ?? 30, onChanged: reload, detailLink: role === "owner" };

  return (
    <div className="space-y-5">
      <OrderAlerts newIds={fresh.map((o) => o.id)} latestNewNo={fresh.at(-1)?.order_no ?? null} onChange={reload} />

      {/* Count strip: one colour per stage */}
      <div className="grid grid-cols-3 gap-2">
        {groups.map((g) => (
          <a key={g.key} href={`#${g.key}`} className={`rounded-2xl px-3 py-3 ring-1 ${STATUS[g.key].pill}`}>
            <span className="block font-display text-[30px] font-extrabold leading-none">{g.list.length}</span>
            <span className="text-[13px] font-bold">{STATUS[g.key].label}</span>
          </a>
        ))}
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox text={error} retry={reload} />
      ) : active.length === 0 ? (
        <Empty icon="bell" title="No orders right now" text="Keep this screen open. New orders ring the alarm and appear here." />
      ) : (
        groups.map(
          (g) =>
            g.list.length > 0 && (
              <section key={g.key} id={g.key} className="scroll-mt-20">
                <h2 className="mb-2 text-[18px] font-bold">{g.title}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {g.list.map((o) => <OrderCard key={o.id} o={o} {...common} />)}
                </div>
              </section>
            ),
        )
      )}

      {data && data.done.length > 0 && (
        <section>
          <h2 className="mb-2 text-[18px] font-bold text-muted">Finished today ({data.done.length})</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.done.map((o) => <OrderCard key={o.id} o={o} {...common} />)}
          </div>
        </section>
      )}
    </div>
  );
}
