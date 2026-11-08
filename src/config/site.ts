/** Fixed facts about the shop and the app. Change here, used everywhere. */

export const SITE_NAME = "Vaishnavi E-Mart";
export const SITE_DESCRIPTION = "Groceries and daily essentials from Vaishnavi Store, delivered to your door in about 30 minutes.";
export const FALLBACK_STORE_NAME = "Vaishnavi Store";
export const THEME_COLOR = "#e30613";

export const TIME_ZONE = "Asia/Kolkata";
/** Order numbers are shown as VS-1012. */
export const ORDER_PREFIX = "VS-";
export const orderLabel = (no: number) => `${ORDER_PREFIX}${no}`;

/** Supabase Storage bucket for product, category and banner photos. */
export const IMAGE_BUCKET = "product-images";
export const MAX_PRODUCT_PHOTOS = 6;

/** Largest quantity of one size in the cart. */
export const MAX_QTY = 20;

/** Keys used in the customer's browser storage. Renaming one forgets what phones saved. */
export const STORAGE_KEYS = {
  cart: "vs-cart-v2",
  favourites: "vs-favs",
  orders: "vs-orders",
  pincode: "vs-pin",
  checkoutDetails: "vs-details-v1",
  /** Session-only: one key per checkout attempt so a double tap never makes two orders. */
  idempotency: "vs-idem",
  coupon: "vs-coupon",
  alarmWanted: "vs-alarm-wanted",
} as const;
/** Event fired in this tab when one of the keys above changes. */
export const LOCAL_CHANGE_EVENT = "vs-local";

export const LEGAL_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/terms", label: "Terms & conditions" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/refund-policy", label: "Returns & refunds" },
  { href: "/shipping-policy", label: "Delivery policy" },
  { href: "/contact", label: "Contact us" },
] as const;
