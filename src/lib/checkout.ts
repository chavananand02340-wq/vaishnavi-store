"use client";

import { supabase } from "@/lib/supabase/browser";

export type QuoteLine = {
  variant_id: string;
  product_name: string;
  variant_label: string;
  unit_price_paise: number;
  qty: number;
  line_total_paise: number;
};

export type Quote = {
  ok: true;
  lines: QuoteLine[];
  subtotal_paise: number;
  delivery_fee_paise: number;
  total_paise: number;
  free_delivery_remaining_paise: number;
  below_min_order: boolean;
  min_order_paise: number | null;
  cod_available: boolean;
  upi_available: boolean;
  store_open: boolean;
  eta_minutes: number;
};

export type QuoteError = {
  ok: false;
  code: string;
  message: string;
  unavailable?: string[];
  insufficient_stock?: { variant_id: string; available: number }[];
  quote?: Quote;
};

const NETWORK: QuoteError = { ok: false, code: "network", message: "No connection to the shop. Check your internet and try again." };

/** Prices the cart in the database (Mumbai). Nothing is trusted from the browser. */
export async function getQuote(items: { variant_id: string; qty: number }[], pincode: string | null): Promise<Quote | QuoteError> {
  try {
    const { data, error } = await supabase().rpc("quote_cart", { p_items: items, p_pincode: pincode });
    if (error || !data) return NETWORK;
    return data as Quote | QuoteError;
  } catch {
    return NETWORK;
  }
}

export type PlaceOrderInput = {
  idempotencyKey: string;
  name: string;
  phone: string;
  address: string;
  landmark: string;
  pincode: string;
  instructions: string;
  payment: "cod" | "upi";
  expectedTotal: number;
  items: { variant_id: string; qty: number }[];
};

export type PlaceOrderResult = { ok: true; public_token: string; order_no: number; duplicate: boolean } | QuoteError;

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
    });
    if (error || !data) return { ...NETWORK, message: "Couldn't reach the shop. Tap Place order again; you won't be charged twice." };
    return data as PlaceOrderResult;
  } catch {
    return { ...NETWORK, message: "Couldn't reach the shop. Tap Place order again; you won't be charged twice." };
  }
}
