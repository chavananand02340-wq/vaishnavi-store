import { formatPaise } from "@/lib/money";
import type { Quote } from "@/app/(store)/actions";

export function Totals({ q, freeEnabled }: { q: Quote; freeEnabled: boolean }) {
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between">
        <dt>Items total</dt>
        <dd>{formatPaise(q.subtotal_paise)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>Delivery</dt>
        <dd>{q.delivery_fee_paise === 0 ? <span className="font-semibold text-brand-700">FREE</span> : formatPaise(q.delivery_fee_paise)}</dd>
      </div>
      {freeEnabled && q.free_delivery_remaining_paise > 0 && (
        <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Add {formatPaise(q.free_delivery_remaining_paise)} more to get FREE delivery.
        </p>
      )}
      <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold">
        <dt>To pay</dt>
        <dd>{formatPaise(q.total_paise)}</dd>
      </div>
    </dl>
  );
}
