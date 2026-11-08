"use client";

import { isPincode } from "@/lib/validation";
import { supabase } from "@/services/supabase/browser";
import type { Spot } from "@/lib/geolocation";

/** Where the customer is: PIN code look-ups and map position → address. Best effort, never throws. */

export type Place = { pincode: string | null; city: string | null; state: string | null; area: string | null };
export type PinInfo = { ok: boolean; city?: string; state?: string; areas?: string[] };

const EMPTY_PLACE: Place = { pincode: null, city: null, state: null, area: null };

/** Map position → PIN code / city / state / area (free browser-side service). */
export async function placeOf(s: Spot): Promise<Place> {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${s.lat}&longitude=${s.lng}&localityLanguage=en`);
    if (!r.ok) return EMPTY_PLACE;
    const j = (await r.json()) as { postcode?: string; city?: string; locality?: string; principalSubdivision?: string };
    return {
      pincode: isPincode(j.postcode) ? j.postcode : null,
      city: j.city || null,
      state: j.principalSubdivision || null,
      area: j.locality && j.locality !== j.city ? j.locality : null,
    };
  } catch {
    return EMPTY_PLACE;
  }
}

const pinCache = new Map<string, Promise<PinInfo>>();

/** PIN code → district, state and post-office area names (through our /api/pincode). */
export function lookupPincode(pin: string): Promise<PinInfo> {
  if (!isPincode(pin)) return Promise.resolve({ ok: false });
  if (!pinCache.has(pin)) {
    const job = fetch(`/api/pincode?pin=${pin}`)
      .then((r) => r.json() as Promise<PinInfo>)
      .catch(() => ({ ok: false }) as PinInfo);
    job.then((r) => !r.ok && pinCache.delete(pin));
    pinCache.set(pin, job);
  }
  return pinCache.get(pin)!;
}

/** Does the shop deliver to this PIN code? Throws only on no connection. */
export async function isPincodeServed(pin: string): Promise<boolean> {
  if (!isPincode(pin)) return false;
  const { data, error } = await supabase().from("delivery_pincodes").select("pincode").eq("pincode", pin).eq("is_active", true).maybeSingle();
  if (error) throw new Error("Couldn't check right now. Try again.");
  return Boolean(data);
}
