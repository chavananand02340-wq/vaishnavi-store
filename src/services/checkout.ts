"use client";

import { supabase } from "@/services/supabase/browser";
import type { CartItemInput, PlaceOrderInput, PlaceOrderResult, PublicCoupon, Quote, QuoteError } from "@/types/order";

/**
 * Checkout: the database (Mumbai) prices the cart and saves the order.
 * Nothing about price is trusted from the browser. These functions never throw;
 * they return a QuoteError the page can show.
 */
const NETWORK: QuoteError = { ok: false, code: "network", message: "No connection to the shop. Check your internet and try again." };
const RETRY_PLACE = "Couldn't reach the shop. Tap Place order again; you won't be charged twice.";

export async function getQuote(items: CartItemInput[], pincode: string | null, coupon: string | null = null): Promise<Quote | QuoteError> {
  try {
    const { data, error } = await supabase().rpc("quote_cart", { p_items: items, p_pincode: pincode, p_coupon: coupon });
    if (error || !data) return NETWORK;
    return data as Quote | QuoteError;
  } catch {
    return NETWORK;
  }
}

export async function placeOrder(d: PlaceOrderInput): Promise<PlaceOrderResult> {
  try {
    const { data, error } = await supabase().rpc("place_order", {
      p_idempotency_key: d.idempotencyKey,
      p_customer_name: d.name,
      p_phone: d.phone,
      p_address_line: d.address,
      p_pincode: d.pincode,
      p_payment_method: d.payment,
      p_items: d.items,
      p_expected_total_paise: d.expectedTotal,
      p_landmark: d.landmark || null,
      p_instructions: d.instructions || null,
      p_upi_utr: null,
      p_coupon_code: d.coupon,
      p_email: d.email || null,
    });
    if (error || !data) return { ...NETWORK, message: RETRY_PLACE };
    return data as PlaceOrderResult;
  } catch {
    return { ...NETWORK, message: RETRY_PLACE };
  }
}

/**
 * Saves the customer's shared map position on their order (once, within 2 hours).
 * Best effort with a time limit: the order is already saved either way.
 */
export async function setOrderLocation(token: string, spot: { lat: number; lng: number; accuracy: number }, timeoutMs = 3000): Promise<boolean> {
  const call = (async () => {
    try {
      const { data, error } = await supabase().rpc("set_order_location", { p_token: token, p_lat: spot.lat, p_lng: spot.lng, p_accuracy_m: spot.accuracy });
      return !error && data === true;
    } catch {
      return false;
    }
  })();
  return Promise.race([call, new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs))]);
}

/** Coupons the shop chose to show at checkout. Empty list if they can't be loaded. */
export async function listCheckoutCoupons(): Promise<PublicCoupon[]> {
  try {
    const { data } = await supabase()
      .from("coupons")
      .select("code, description, kind, value, min_order_paise, max_discount_paise, ends_at")
      .order("min_order_paise");
    return (data ?? []) as PublicCoupon[];
  } catch {
    return [];
  }
}

/** Asks our server to send the order emails (fire and forget). */
export function requestOrderEmail(token: string, event: "placed" | "packing" = "placed") {
  try {
    void fetch("/api/order-email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, event }), keepalive: true }).catch(() => {});
  } catch {
    /* email is a nice-to-have; the order is already saved */
  }
}
