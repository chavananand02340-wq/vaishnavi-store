export type SaleTheme = "festive" | "red" | "green" | "night";

/** Store settings anyone may read (the storefront). */
export type PublicSettings = {
  store_name: string;
  tagline: string | null;
  address: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  whatsapp_number: string | null;
  instagram_url: string | null;
  maps_url: string | null;
  open_time: string;
  close_time: string;
  accepting_orders: boolean;
  closed_message: string | null;
  announcement: string | null;
  delivery_fee_paise: number;
  free_delivery_enabled: boolean;
  free_delivery_threshold_paise: number;
  min_order_paise: number | null;
  default_eta_minutes: number;
  cod_enabled: boolean;
  upi_enabled: boolean;
  sale_enabled: boolean;
  sale_title: string | null;
  sale_subtitle: string | null;
  sale_percent: number | null;
  sale_coupon_code: string | null;
  razorpay_enabled?: boolean;
  sale_image_path?: string | null;
  sale_link_url?: string | null;
  sale_theme: SaleTheme;
  legal_name: string | null;
  gstin: string | null;
  fssai_number: string | null;
  support_email: string | null;
};

/** Every column the owner can edit (Admin → Shop settings, Banners). */
export type StoreSettings = PublicSettings & {
  email: string | null;
  upi_id: string | null;
  upi_payee_name: string | null;
  low_stock_threshold: number;
  notify_email: string | null;
};

/** Opening hours as stored (24 h "HH:MM"). */
export type Hours = Pick<PublicSettings, "open_time" | "close_time" | "accepting_orders">;
