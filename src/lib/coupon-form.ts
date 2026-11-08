import { AppError } from "@/lib/errors";
import { rupeesToPaise } from "@/lib/money";

/** Admin → Coupons "new coupon" form: checks and the database row. Pure. */

export type CouponForm = {
  code: string;
  description: string;
  kind: "percent" | "flat";
  value: string;
  min_order: string;
  max_discount: string;
  ends_on: string;
  usage_limit: string;
  once_per_customer: boolean;
  show_in_checkout: boolean;
};

/** End of the chosen day, India time. */
export function endOfDayIST(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return new Date(`${date}T23:59:59+05:30`).toISOString();
}

/** Checks the form and returns the database row. Throws AppError("invalid") with what to fix. */
export function couponFromForm(f: CouponForm) {
  const bad = (m: string) => new AppError("invalid", m);
  if (!/^[A-Z0-9]{3,20}$/.test(f.code)) throw bad("Code: 3 to 20 letters or numbers, no spaces");
  let value: number | null;
  if (f.kind === "percent") {
    value = Number(f.value);
    if (!Number.isInteger(value) || value < 1 || value > 90) throw bad("Percent must be a whole number from 1 to 90");
  } else {
    value = rupeesToPaise(f.value);
    if (!value || value <= 0) throw bad("Enter the rupees off");
  }
  const min = f.min_order.trim() ? rupeesToPaise(f.min_order) : 0;
  if (min == null) throw bad("Minimum order isn't a valid amount");
  const cap = f.kind === "percent" && f.max_discount.trim() ? rupeesToPaise(f.max_discount) : null;
  if (f.kind === "percent" && f.max_discount.trim() && !cap) throw bad("Maximum discount isn't a valid amount");
  const limit = f.usage_limit.trim() ? Number(f.usage_limit) : null;
  if (limit != null && (!Number.isInteger(limit) || limit < 1)) throw bad("Total uses must be a whole number");
  return {
    code: f.code,
    description: f.description.trim() || null,
    kind: f.kind,
    value,
    min_order_paise: min,
    max_discount_paise: cap,
    ends_at: f.ends_on ? endOfDayIST(f.ends_on) : null,
    usage_limit: limit,
    per_phone_limit: f.once_per_customer ? 1 : null,
    show_in_checkout: f.show_in_checkout,
    is_active: true,
  };
}
