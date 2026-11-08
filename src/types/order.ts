/** Order shapes shared by checkout, the customer's tracking page and the shop panel. */

export type OrderStatus = "new" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled";
export type PaymentMethod = "cod" | "upi" | "online";
export type PaymentStatus = "unpaid" | "awaiting_verification" | "paid";

// ---------- Checkout ----------

export type QuoteLine = {
  variant_id: string;
  product_name: string;
  variant_label: string;
  unit_price_paise: number;
  qty: number;
  line_total_paise: number;
};

/** The database's price for a cart (nothing is trusted from the browser). */
export type Quote = {
  ok: true;
  lines: QuoteLine[];
  subtotal_paise: number;
  delivery_fee_paise: number;
  discount_paise: number;
  coupon: { code: string; discount_paise: number; description: string | null } | null;
  coupon_error: string | null;
  total_paise: number;
  free_delivery_remaining_paise: number;
  below_min_order: boolean;
  min_order_paise: number | null;
  cod_available: boolean;
  upi_available: boolean;
  online_available?: boolean;
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

export type CartItemInput = { variant_id: string; qty: number };

export type PlaceOrderInput = {
  idempotencyKey: string;
  name: string;
  phone: string;
  address: string;
  landmark: string;
  pincode: string;
  instructions: string;
  payment: PaymentMethod;
  coupon: string | null;
  email: string;
  expectedTotal: number;
  items: CartItemInput[];
};

export type PlaceOrderResult = { ok: true; public_token: string; order_no: number; duplicate: boolean } | QuoteError;

export type PublicCoupon = {
  code: string;
  description: string | null;
  kind: "percent" | "flat";
  value: number;
  min_order_paise: number;
  max_discount_paise: number | null;
  ends_at: string | null;
};

// ---------- Customer tracking page ----------

export type TrackedOrder = {
  order_no: number;
  status: OrderStatus;
  created_at: string;
  confirmed_at: string | null;
  eta_minutes: number | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal_paise: number;
  delivery_fee_paise: number;
  discount_paise?: number;
  coupon_code?: string | null;
  total_paise: number;
  customer_first_name: string;
  items: { product_name: string; variant_label: string; qty: number; line_total_paise: number; is_unavailable: boolean }[];
};

// ---------- Shop panel ----------

export type OrderItem = {
  id: number;
  product_name: string;
  variant_label: string;
  qty: number;
  unit_price_paise: number;
  line_total_paise: number;
  is_unavailable: boolean;
};

export type OrderRow = {
  id: string;
  order_no: number;
  public_token: string;
  status: OrderStatus;
  customer_name: string;
  phone: string;
  address_line: string;
  landmark: string | null;
  pincode: string;
  instructions: string | null;
  subtotal_paise: number;
  delivery_fee_paise: number;
  discount_paise: number;
  coupon_code: string | null;
  customer_email: string | null;
  /** Only after SQL part 26. */
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  location_accuracy_m?: number | null;
  total_paise: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  upi_utr: string | null;
  eta_minutes: number | null;
  cancel_reason: string | null;
  created_at: string;
  confirmed_at: string | null;
  order_items: OrderItem[];
};

/** Short row for lists (dashboard, all orders). */
export type OrderSummary = Pick<OrderRow, "id" | "order_no" | "customer_name" | "phone" | "total_paise" | "status" | "payment_method" | "payment_status" | "created_at">;

export type OrderHistoryEntry = { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string };

/** Answer of the order-action database functions. */
export type ActionResult = { ok: boolean; message?: string };
