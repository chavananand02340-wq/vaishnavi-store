"use client";

import { useState } from "react";
import { currentSpot, type Spot } from "@/lib/geolocation";
import { Icon } from "@/components/ui/Icon";
import { placeOf, type Place } from "@/services/location";

/**
 * "Use my current location": the delivery person gets the exact spot on the map,
 * and PIN code / city / state are filled in for the customer.
 */
export function LocationButton({ spot, onSpot, onPlace }: { spot: Spot | null; onSpot: (s: Spot | null) => void; onPlace: (p: Place) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function locate() {
    setBusy(true);
    setErr(null);
    try {
      const s = await currentSpot();
      if (s.lat < 6 || s.lat > 38 || s.lng < 68 || s.lng > 98) throw new Error("outside");
      onSpot(s);
      onPlace(await placeOf(s));
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setErr(
        m === "denied"
          ? "Location permission is off. Allow location for this site in your browser settings, or just type the address."
          : m === "outside"
            ? "That location is outside India. Please type your address."
            : m === "unsupported"
              ? "This browser can't share location. Please type your address."
              : "Couldn't get your location. Turn on GPS and try again, or type the address.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (spot) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-200">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Icon name="pin" className="size-5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-emerald-900">Live location added ✓</p>
          <p className="text-[13px] leading-snug text-emerald-800">
            The delivery person will see your exact spot on the map{spot.accuracy ? ` (±${spot.accuracy} m)` : ""}. Still add your house number below.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <a href={`https://www.google.com/maps?q=${spot.lat},${spot.lng}`} target="_blank" rel="noopener" className="text-[13px] font-bold text-emerald-800 underline">
            View
          </a>
          <button type="button" onClick={() => onSpot(null)} className="text-[13px] font-bold text-rose-700">
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50 px-3 py-3 text-left active:scale-[.99]"
      >
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white ${busy ? "animate-pulse" : ""}`}>
          <Icon name="pin" className="size-5" strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-extrabold text-brand-800">{busy ? "Finding you…" : "Use my current location"}</span>
          <span className="block text-[13px] text-brand-800/80">Fastest delivery: we reach your exact spot. Fills PIN, city and state.</span>
        </span>
        <Icon name="right" className="size-5 shrink-0 text-brand-700" strokeWidth={2.6} />
      </button>
      {err && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{err}</p>}
    </div>
  );
}
