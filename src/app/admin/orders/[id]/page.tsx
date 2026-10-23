import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/Notice";
import { ORDER_SELECT, OrderCard, STATUS_LABEL, istTime, type OrderRow } from "@/components/orders/OrderCard";

type History = { id: number; from_status: OrderRow["status"] | null; to_status: OrderRow["status"]; note: string | null; created_at: string };

export default async function AdminOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data }, { data: hist }, { data: s }] = await Promise.all([
    supabase.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle(),
    supabase.from("order_status_history").select("id, from_status, to_status, note, created_at").eq("order_id", id).order("created_at"),
    supabase.from("store_settings").select("store_name, default_eta_minutes").eq("id", 1).single(),
  ]);
  if (!data) notFound();
  const o = data as unknown as OrderRow;
  const history = (hist ?? []) as unknown as History[];

  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="text-sm text-brand-700">‹ All orders</Link>
      <Notice error={error ? (error === "invalid" ? "Something went wrong. Refresh and try again." : error) : null} />
      <OrderCard
        o={o}
        isOwner
        returnTo={`/admin/orders/${o.id}`}
        storeName={(s?.store_name as string) ?? "Vaishnavi Store"}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? null}
        defaultEta={(s?.default_eta_minutes as number) ?? 30}
      />
      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">History</h2>
        <ol className="space-y-1">
          {history.map((h) => (
            <li key={h.id} className="flex gap-2">
              <span className="w-20 shrink-0 text-neutral-500">{istTime(h.created_at)}</span>
              <span>
                {h.from_status === h.to_status ? "" : STATUS_LABEL[h.to_status]}
                {h.note ? `${h.from_status === h.to_status ? "" : " — "}${h.note}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
