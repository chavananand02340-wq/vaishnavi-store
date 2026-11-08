"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getOrderDetail } from "@/services/admin/orders";
import { isUuid } from "@/lib/validation";
import { istTime } from "@/lib/time";
import { useAsync } from "@/hooks/useAsync";
import { OrderCard } from "@/components/admin/OrderCard";
import { Card, CardTitle, Empty, ErrorBox, Spinner, STATUS } from "@/components/admin/AdminUI";
import { Icon } from "@/components/ui/Icon";

function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const valid = isUuid(id);
  const { data, error, loading, reload } = useAsync(async () => {
    if (!valid) return null;
    return getOrderDetail(id);
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
