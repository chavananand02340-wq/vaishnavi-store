import { TIME_ZONE } from "@/config/site";
import type { Hours } from "@/types/settings";

/**
 * India-time helpers. The shop runs on IST (UTC+5:30, no daylight saving),
 * whatever time zone the phone or server is set to.
 * Opening-hours checks are for display only; the database re-checks at checkout.
 */
const IST_OFFSET_MIN = 330;

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Minutes past midnight in India now. */
export function istMinutesNow(now = new Date()): number {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/** Hour of the day in India (0–23). */
export const istHour = (now = new Date()) => Math.floor(istMinutesNow(now) / 60);

/** Open now? Handles hours that pass midnight (e.g. 18:00–01:00). */
export function isOpenNow(h: Hours, now = new Date()): boolean {
  if (!h.accepting_orders) return false;
  const t = istMinutesNow(now);
  const o = minutes(h.open_time);
  const c = minutes(h.close_time);
  return o <= c ? t >= o && t < c : t >= o || t < c;
}

/** "09:00:00" → "9 am", "18:30" → "6:30 pm". */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${suffix}` : `${hh} ${suffix}`;
}

/** "2026-11-08" in India (for grouping by day). */
export function istDateKey(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

/** "8 Nov" */
export function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TIME_ZONE });
}

/** "2:20 pm" */
export function istTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TIME_ZONE });
}

/** Start of today (or `daysAgo` days back) in India, as an ISO timestamp for database filters. */
export function istDayStartISO(daysAgo = 0): string {
  const now = new Date(Date.now() + IST_OFFSET_MIN * 60_000);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - IST_OFFSET_MIN * 60_000;
  return new Date(midnight - daysAgo * 86_400_000).toISOString();
}
