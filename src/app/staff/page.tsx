import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { advanceOrder, markCashCollected } from "./actions";

type Item = { id: number; product_name: string; variant_label: string; qty: number; is_unavailable: boolean };
type Order = {
  id: string;
  order_no: number;
  status: "new" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled";
  customer_name: string;
  phone: string;
  address_line: string;
  landmark: string | null;
  pincode: string;
  instructions: string | null;
  total_paise: number;
  payment_method: "cod" | "upi";
  payment_status: "unpaid" | "awaiting_verification" | "paid";
  eta_minutes: number | null;
  created_at: string;
  order_items: Item[];
};

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  new: { to: "confirmed", label: "Confirm order" },
  confirmed: { to: "out_for_delivery", label: "Out for delivery" },
  out_for_delivery: { to: "delivered", label: "Mark delivered" },
};

const STATUS_LABEL: Record<Order["status"], string> = {
  new: "New",
  confirmed: "Confirmed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function StaffOrders({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  // RLS limits staff to active orders + today's orders.
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_no, status, customer_name, phone, address_line, landmark, pincode, instructions, total_paise, payment_method, payment_status, eta_minutes, created_at, order_items(id, product_name, variant_label, qty, is_unavailable)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const orders = (data ?? []) as unknown as Order[];
  const active = orders.filter((o) => NEXT[o.status]);
  const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const today = istDay(new Date());
  const done = orders.filter((o) => !NEXT[o.status] && istDay(new Date(o.created_at)) === today);

  return (
    <div className="space-y-6">
      <Notice error={error ? (error === "invalid" ? "Something went wrong. Refresh and try again." : error) : null} />
      <section>
        <h1 className="mb-3 text-xl font-bold">Active orders ({active.length})</h1>
        {active.length === 0 ? (
          <p className="card text-sm text-neutral-600">No active orders right now.</p>
        ) : (
          <div className="space-y-3">{active.map((o) => <OrderCard key={o.id} o={o} />)}</div>
        )}
      </section>
      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-neutral-700">Finished today</h2>
          <div className="space-y-3">{done.map((o) => <OrderCard key={o.id} o={o} />)}</div>
        </section>
      )}
      <p className="text-xs text-neutral-500">New-order sound alerts are added in the orders phase.</p>
    </div>
  );
}

function OrderCard({ o }: { o: Order }) {
  const next = NEXT[o.status];
  const placed = new Date(o.created_at).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  return (
    <article className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">VS-{o.order_no}</p>
          <p className="text-xs text-neutral-500">Placed {placed}{o.eta_minutes ? ` · ETA ${o.eta_minutes} min` : ""}</p>
        </div>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">{STATUS_LABEL[o.status]}</span>
      </div>

      <ul className="space-y-0.5 text-sm">
        {o.order_items.map((i) => (
          <li key={i.id} className={i.is_unavailable ? "text-neutral-400 line-through" : ""}>
            {i.qty} × {i.product_name} <span className="text-neutral-500">({i.variant_label})</span>
          </li>
        ))}
      </ul>

      <div className="rounded-lg bg-neutral-50 p-3 text-sm">
        <p className="font-medium">{o.customer_name}</p>
        <p>{o.address_line}{o.landmark ? `, near ${o.landmark}` : ""} – {o.pincode}</p>
        {o.instructions && <p className="mt-1 text-neutral-600">Note: {o.instructions}</p>}
        <div className="mt-2 flex gap-2">
          <a className="btn-ghost flex-1" href={`tel:+91${o.phone}`}>Call</a>
          <a className="btn-ghost flex-1" href={`https://wa.me/91${o.phone}`} rel="noopener">WhatsApp</a>
        </div>
      </div>

      <p className="text-sm">
        <span className="font-semibold">{formatPaise(o.total_paise)}</span> ·{" "}
        {o.payment_method === "cod" ? "Cash on Delivery" : "UPI"} ·{" "}
        {o.payment_status === "paid" ? "Paid" : o.payment_status === "awaiting_verification" ? "Owner to verify" : "Not collected"}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        {next && (
          <form action={advanceOrder} className="flex-1">
            <input type="hidden" name="order_id" value={o.id} />
            <input type="hidden" name="to" value={next.to} />
            <SubmitButton className="btn-primary w-full" pendingText="Updating…">{next.label}</SubmitButton>
          </form>
        )}
        {o.payment_method === "cod" && o.payment_status !== "paid" && o.status !== "cancelled" && (
          <form action={markCashCollected} className="flex-1">
            <input type="hidden" name="order_id" value={o.id} />
            <SubmitButton className="btn-ghost w-full" pendingText="Updating…">Cash collected</SubmitButton>
          </form>
        )}
      </div>
    </article>
  );
}
