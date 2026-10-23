/**
 * Delivery fee rule — display copy only.
 * The authoritative calculation is the database function `_build_quote`
 * (supabase/migrations). Keep the two in sync; tests cover the rule here.
 *
 *   base fee = PIN-code override if set, otherwise the store delivery fee
 *   fee      = 0 when free delivery is enabled AND subtotal >= threshold
 *            = base fee otherwise (including when free delivery is disabled)
 *   COD availability never depends on the amount.
 */
export type DeliveryRule = {
  deliveryFeePaise: number;
  freeDeliveryEnabled: boolean;
  freeDeliveryThresholdPaise: number;
  pincodeFeeOverridePaise?: number | null;
};

export function deliveryFeePaise(subtotalPaise: number, rule: DeliveryRule): number {
  const base = rule.pincodeFeeOverridePaise ?? rule.deliveryFeePaise;
  if (rule.freeDeliveryEnabled && subtotalPaise >= rule.freeDeliveryThresholdPaise) return 0;
  return base;
}

export function amountToFreeDeliveryPaise(subtotalPaise: number, rule: DeliveryRule): number {
  if (!rule.freeDeliveryEnabled) return 0;
  return Math.max(0, rule.freeDeliveryThresholdPaise - subtotalPaise);
}
