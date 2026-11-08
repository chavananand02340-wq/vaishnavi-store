"use client";

import { getLiveOrders, isAwaitingOnlinePayment } from "@/services/admin/orders";
import { useAsync } from "@/hooks/useAsync";
import { useTeam } from "@/state/team";
import { OrderAlerts } from "@/components/admin/OrderAlerts";
import { OrderCard } from "@/components/admin/OrderCard";
import { Empty, ErrorBox, Spinner, STATUS } from "@/components/admin/AdminUI";
import type { OrderRow } from "@/types/order";

/** Counter screen: every order still moving, grouped by stage, with the new-order alarm. */
export default function LiveOrders() {
  const { role } = useTeam();
  const { data, error, loading, reload } = useAsync(getLiveOrders);

  const active = data?.active ?? [];
  const unpaidOnline = (o: OrderRow) => isAwaitingOnlinePayment(o);
  const fresh = active.filter((o) => o.status === "new" && !unpaidOnline(o));
  const groups = [
    { key: "new", title: "New, confirm these", list: fresh },
    { key: "confirmed", title: "Packing", list: active.filter((o) => o.status === "confirmed") },
    { key: "out_for_delivery", title: "On the way", list: active.filter((o) => o.status === "out_for_delivery") },
    { key: "awaiting_payment", title: "Waiting for online payment (don't pack yet)", list: active.filter((o) => o.status === "new" && unpaidOnline(o)) },
  ];
  const common = { isOwner: role === "owner", storeName: data?.storeName ?? "", defaultEta: data?.eta ?? 30, onChanged: reload, detailLink: role === "owner" };

  return (
    <div className="space-y-5">
      <OrderAlerts newIds={fresh.map((o) => o.id)} onChange={reload} />

      {/* Count strip: one colour per stage */}
      <div className="grid grid-cols-3 gap-2">
        {groups.slice(0, 3).map((g) => (
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
                <h2 className={`mb-2 text-[18px] font-bold ${g.key === "awaiting_payment" ? "text-muted" : ""}`}>{g.title}</h2>
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
