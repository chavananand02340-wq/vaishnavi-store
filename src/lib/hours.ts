/** Store-hours helpers (display only — the database re-checks at checkout). */

export type Hours = { open_time: string; close_time: string; accepting_orders: boolean };

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Current minutes past midnight in India. */
export function istMinutesNow(now = new Date()): number {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export function isOpenNow(h: Hours, now = new Date()): boolean {
  if (!h.accepting_orders) return false;
  const t = istMinutesNow(now);
  const o = minutes(h.open_time);
  const c = minutes(h.close_time);
  return o <= c ? t >= o && t < c : t >= o || t < c;
}

export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${suffix}` : `${hh} ${suffix}`;
}

export function istDateKey(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function istTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

export function istDayStartISO(daysAgo = 0): string {
  const now = new Date(Date.now() + 330 * 60_000);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 330 * 60_000;
  return new Date(midnight - daysAgo * 86_400_000).toISOString();
}
