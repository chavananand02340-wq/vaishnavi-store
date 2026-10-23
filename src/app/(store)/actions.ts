"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  min_order_paise?: number;
};

const items = z
  .array(z.object({ variant_id: z.string().uuid(), qty: z.number().int().min(1).max(50) }))
  .min(1)
  .max(60);

const pin = z.string().regex(/^[1-9]\d{5}$/);

export async function checkPincode(pincode: string): Promise<{ ok: boolean; area?: string | null; message: string }> {
  const p = pin.safeParse(String(pincode).trim());
  if (!p.success) return { ok: false, message: "Enter a valid 6-digit PIN code." };
  const supabase = await createClient();
  const { data } = await supabase.from("delivery_pincodes").select("pincode, area_name").eq("pincode", p.data).eq("is_active", true).maybeSingle();
  if (!data) return { ok: false, message: `Sorry, we don't deliver to ${p.data} yet.` };
  return { ok: true, area: data.area_name as string | null, message: `We deliver to ${p.data}.` };
}

export async function getQuote(cart: unknown, pincode?: string | null): Promise<Quote | QuoteError> {
  const parsed = items.safeParse(cart);
  if (!parsed.success) return { ok: false, code: "invalid_items", message: "Your cart could not be read. Please refresh." };
  const p = pincode && pin.safeParse(pincode.trim()).success ? pincode.trim() : null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_cart", { p_items: parsed.data, p_pincode: p });
  if (error || !data) return { ok: false, code: "network", message: "Could not reach the store. Check your internet and try again." };
  return data as Quote | QuoteError;
}

const orderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  phone: z.string().trim().min(10, "Enter a 10-digit mobile number.").max(16),
  address: z.string().trim().min(5, "Please enter your full address.").max(300),
  landmark: z.string().trim().max(120).optional().default(""),
  pincode: pin,
  instructions: z.string().trim().max(300).optional().default(""),
  payment: z.enum(["cod", "upi"]),
  expectedTotal: z.number().int().min(0),
  items,
  website: z.string().max(0).optional().default(""), // honeypot: real people leave it empty
});

export type PlaceOrderResult =
  | { ok: true; public_token: string; order_no: number; duplicate: boolean }
  | QuoteError;

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    if (first.path[0] === "website") return { ok: false, code: "invalid_request", message: "Please try again." };
    if (first.path[0] === "pincode") return { ok: false, code: "invalid_pincode", message: "Please enter a valid 6-digit PIN code." };
    return { ok: false, code: "invalid_input", message: first.message.startsWith("Please") || first.message.startsWith("Enter") ? first.message : "Please check your details." };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
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
  if (error || !data) {
    return { ok: false, code: "network", message: "Could not place the order. Check your internet and try again — you won't be charged twice." };
  }
  return data as PlaceOrderResult;
}

export async function submitUtr(token: string, utr: string): Promise<{ ok: boolean; message?: string }> {
  if (!z.string().uuid().safeParse(token).success) return { ok: false, message: "Invalid order." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_upi_utr", { p_token: token, p_utr: String(utr).slice(0, 40) });
  if (error || !data) return { ok: false, message: "Could not save. Try again." };
  return data as { ok: boolean; message?: string };
}
