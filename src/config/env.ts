/**
 * Public settings, safe in the browser.
 *
 * Next.js copies NEXT_PUBLIC_* values into the code when it builds, so each one
 * must be read with its full literal name (no dynamic `process.env[key]`).
 * Secrets never go here: see `server-env.ts`.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /** Public address of the shop without a trailing slash, e.g. https://vaishnavistores.shop */
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, ""),
} as const;

/** True when the database address and public key are both set. */
export const hasSupabase = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
