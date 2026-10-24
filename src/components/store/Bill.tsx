import { formatPaise } from "@/lib/money";

export function Bill({ subtotal, fee, total, remaining }: { subtotal: number; fee: number; total: number; remaining?: number }) {
  return (
    <dl className="space-y-2 text-[15px]">
      <div className="flex justify-between">
        <dt className="text-muted">Items total</dt>
        <dd className="font-semibold">{formatPaise(subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">Delivery</dt>
        <dd className="font-semibold">{fee === 0 ? <span className="text-leaf-700">Free</span> : formatPaise(fee)}</dd>
      </div>
      {remaining ? (
        <p className="rounded-lg bg-haldi-100 px-3 py-2 text-[14px] font-semibold text-haldi-700">
          Add {formatPaise(remaining)} more and delivery is free.
        </p>
      ) : null}
      <div className="flex justify-between border-t border-dashed border-line pt-3 text-[18px] font-extrabold">
        <dt>To pay</dt>
        <dd>{formatPaise(total)}</dd>
      </div>
    </dl>
  );
}
