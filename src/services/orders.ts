"use client";

import { supabase } from "@/services/supabase/browser";
import { isUuid } from "@/lib/validation";
import { AppError } from "@/lib/errors";
import type { ActionResult, TrackedOrder } from "@/types/order";

/** Customer-side order calls. Access is by the secret tracking token only. */

/** The customer's view of one order, or null if the token is unknown. */
export async function getTrackedOrder(token: string): Promise<TrackedOrder | null> {
  if (!isUuid(token)) return null;
  const { data, error } = await supabase().rpc("get_order_by_token", { p_token: token });
  if (error) throw new AppError("network", "Couldn't load your order. Check your internet.", { cause: error });
  return (data as TrackedOrder | null) ?? null;
}

/** Shop's UPI ID and name for the pay-by-QR box (old UPI option). */
export async function getUpiPayee(): Promise<{ upiId: string; payeeName: string | null } | null> {
  const { data } = await supabase().from("store_settings").select("upi_id, upi_payee_name").eq("id", 1).maybeSingle();
  if (!data?.upi_id) return null;
  return { upiId: data.upi_id as string, payeeName: (data.upi_payee_name as string | null) ?? null };
}

/** Customer types the UPI reference number after paying. */
export async function submitUpiReference(token: string, utr: string): Promise<ActionResult> {
  try {
    const { data } = await supabase().rpc("submit_upi_utr", { p_token: token, p_utr: utr });
    return (data as ActionResult | null) ?? { ok: false, message: "Couldn't save. Try again." };
  } catch {
    return { ok: false, message: "No internet connection. Try again." };
  }
}
