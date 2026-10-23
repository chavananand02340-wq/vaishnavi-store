import { requireTeam } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/Notice";
import { OrderAlerts } from "@/components/orders/OrderAlerts";
import { ORDER_SELECT, OrderCard, type OrderRow } from "@/components/orders/OrderCard";

const ACTIVE = ["new", "confirmed", "out_for_delivery"] as const;

function istDay(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default async function StaffOrders({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const me = await requireTeam();
  const supabase = await createClient();

  // RLS limits staff to active orders + today's orders.
  const since = new Date(Date.now() - 36 * 3600_000).toISOString();
  const [{ data: activeData }, { data: recentData }, { data: s }] = await Promise.all([
    supabase.from("orders").select(ORDER_SELECT).in("status", [...ACTIVE]).order("created_at", { ascending: true }).limit(100),
    supabase.from("orders").select(ORDER_SELECT).in("status", ["delivered", "cancelled"]).gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    supabase.from("store_settings").select("store_name, default_eta_minutes").eq("id", 1).single(),
  ]);

  const active = (activeData ?? []) as unknown as OrderRow[];
  const today = istDay(new Date());
  const finished = ((recentData ?? []) as unknown as OrderRow[]).filter((o) => istDay(new Date(o.created_at)) === today);
  const newOnes = active.filter((o) => o.status === "new");
  const latestNew = newOnes[newOnes.length - 1];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? null;
  const common = {
    isOwner: me.role === "owner",
    returnTo: "/staff",
    storeName: (s?.store_name as string) ?? "Vaishnavi Store",
    siteUrl,
    defaultEta: (s?.default_eta_minutes as number) ?? 30,
    showDetailLink: me.role === "owner",
  };

  const groups: { title: string; list: OrderRow[] }[] = [
    { title: "New — confirm these", list: newOnes },
    { title: "Packing", list: active.filter((o) => o.status === "confirmed") },
    { title: "Out for delivery", list: active.filter((o) => o.status === "out_for_delivery") },
  ];

  return (
    <div className="space-y-6">
      <OrderAlerts newIds={newOnes.map((o) => o.id)} latestNewNo={latestNew?.order_no ?? null} />
      <Notice error={error ? (error === "invalid" ? "Something went wrong. Refresh and try again." : error) : null} />

      {active.length === 0 && <p className="card text-center text-sm text-neutral-600">No active orders right now.</p>}

      {groups.map(
        (g) =>
          g.list.length > 0 && (
            <section key={g.title}>
              <h2 className="mb-3 text-lg font-bold">
                {g.title} ({g.list.length})
              </h2>
              <div className="space-y-3">
                {g.list.map((o) => <OrderCard key={o.id} o={o} {...common} />)}
              </div>
            </section>
          ),
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-neutral-700">Finished today ({finished.length})</h2>
          <div className="space-y-3">
            {finished.map((o) => <OrderCard key={o.id} o={o} {...common} />)}
          </div>
        </section>
      )}
    </div>
  );
}
