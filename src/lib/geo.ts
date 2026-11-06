"use client";

export type Spot = { lat: number; lng: number; accuracy: number };
export type Place = { pincode: string | null; city: string | null; state: string | null; area: string | null };

/** Asks the phone for its current position (the browser shows a permission prompt). */
export function currentSpot(): Promise<Spot> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

/** Turns a position into PIN code / city / state / area (free browser-side service; best effort). */
export async function placeOf(s: Spot): Promise<Place> {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${s.lat}&longitude=${s.lng}&localityLanguage=en`,
    );
    const j = (await r.json()) as { postcode?: string; city?: string; locality?: string; principalSubdivision?: string };
    return {
      pincode: j.postcode && /^[1-9]\d{5}$/.test(j.postcode) ? j.postcode : null,
      city: j.city || null,
      state: j.principalSubdivision || null,
      area: j.locality && j.locality !== j.city ? j.locality : null,
    };
  } catch {
    return { pincode: null, city: null, state: null, area: null };
  }
}

export type PinInfo = { ok: boolean; city?: string; state?: string; areas?: string[] };
const pinCache = new Map<string, Promise<PinInfo>>();
export function pinInfo(pin: string): Promise<PinInfo> {
  if (!pinCache.has(pin)) {
    pinCache.set(
      pin,
      fetch(`/api/pincode?pin=${pin}`)
        .then((r) => r.json() as Promise<PinInfo>)
        .catch(() => ({ ok: false })),
    );
  }
  return pinCache.get(pin)!;
}
