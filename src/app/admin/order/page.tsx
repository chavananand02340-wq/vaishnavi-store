"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase/browser";
import { istTime } from "@/lib/hours";
import { useAsync, must } from "@/lib/useAsync";
import { ORDER_SELECT, OrderCard, type OrderRow } from "@/components/admin/OrderCard";
import { Card, CardTitle, Empty, ErrorBox, Spinner, STATUS } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";

type History = { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string };

function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const { data, error, loading, reload } = useAsync(async () => {
    if (!valid) return null;
    const sb = supabase();
    const [o, h, s] = await Promise.all([
      sb.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle(),
      sb.from("order_status_history").select("id, from_status, to_status, note, created_at").eq("order_id", id).order("created_at"),
      sb.from("store_settings").select("store_name, default_eta_minutes").eq("id", 1).single(),
    ]);
    return {
      order: must(o) as unknown as OrderRow | null,
      history: (must(h) ?? []) as History[],
      storeName: (s.data?.store_name as string) ?? "Vaishnavi Store",
      eta: (s.data?.default_eta_minutes as number) ?? 30,
    };
  }, [id]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data?.order) return <Empty icon="orders" title="Order not found" action={<Link href="/admin/orders" className="btn-plain">All orders</Link>} />;

  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-[15px] font-bold text-indigo-700">
        <Icon name="left" className="size-4" strokeWidth={2.6} /> All orders
      </Link>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <OrderCard o={data.order} isOwner storeName={data.storeName} defaultEta={data.eta} onChanged={reload} />
        <Card>
          <CardTitle>What happened</CardTitle>
          <ol className="space-y-3">
            {data.history.map((h) => (
              <li key={h.id} className="flex gap-3 text-[15px]">
                <span className="w-[4.5rem] shrink-0 text-muted">{istTime(h.created_at)}</span>
                <span>
                  {h.from_status !== h.to_status && <b>{STATUS[h.to_status]?.label ?? h.to_status}</b>}
                  {h.note && <span className="block text-muted">{h.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Detail />
    </Suspense>
  );
}
