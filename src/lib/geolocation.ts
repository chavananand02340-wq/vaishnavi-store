"use client";



/** The phone's own position (the browser shows a permission prompt). Needs HTTPS. */

export type Spot = { lat: number; lng: number; accuracy: number };
export type SpotError = "unsupported" | "denied" | "timeout" | "unavailable";

export function currentSpot(): Promise<Spot> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return reject(new Error("unsupported" satisfies SpotError));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error((e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable") satisfies SpotError)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}
