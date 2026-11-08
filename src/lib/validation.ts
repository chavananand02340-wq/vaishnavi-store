/** Small input checks shared by the browser, the API routes and the tests. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Database ids and order tracking tokens are UUIDs. */
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Indian PIN code: 6 digits, not starting with 0. */
export const isPincode = (v: unknown): v is string => typeof v === "string" && /^[1-9]\d{5}$/.test(v);

/** Indian mobile number without +91: 10 digits starting 6–9. */
export const isMobile = (v: unknown): v is string => typeof v === "string" && /^[6-9]\d{9}$/.test(v);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
