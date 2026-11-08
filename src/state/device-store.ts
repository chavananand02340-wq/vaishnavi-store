"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/config/site";
import { isPincode } from "@/lib/validation";
import { onKeyChange, readJson, readText, remove, write } from "@/lib/browser-storage";

/**
 * What this phone remembers for the customer (no login needed):
 * favourites, orders placed here, delivery PIN, checkout details and a chosen coupon.
 * Lives only in this browser. Every read/write is safe if storage is blocked.
 */

/** Subscribes a component to one stored value. `ready` is false until read in the browser. */
function useStored<T>(key: string, read: () => T, initial: T): [T, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setValue(read());
    setReady(true);
    return onKeyChange(key, () => setValue(read()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, ready];
}

// ---------- Favourites ----------

const readFavs = () => readJson<string[]>(STORAGE_KEYS.favourites, []);

export function useFavourites() {
  const [ids, ready] = useStored(STORAGE_KEYS.favourites, readFavs, [] as string[]);
  return {
    ids,
    ready,
    has: (id: string) => ids.includes(id),
    /** Adds or removes; returns true if it is now a favourite. */
    toggle: (id: string) => {
      const cur = readFavs();
      const added = !cur.includes(id);
      write(STORAGE_KEYS.favourites, added ? [id, ...cur].slice(0, 100) : cur.filter((x) => x !== id));
      return added;
    },
  };
}

// ---------- Orders placed from this phone ----------

export type SavedLine = { variantId: string; productId: string; name: string; label: string; price: number; image: string | null; qty: number };
export type SavedOrder = { token: string; no: number; at: string; total: number; lines: SavedLine[] };

const readOrders = () => readJson<SavedOrder[]>(STORAGE_KEYS.orders, []);

export function saveOrder(o: SavedOrder) {
  write(STORAGE_KEYS.orders, [o, ...readOrders().filter((x) => x.token !== o.token)].slice(0, 30));
}

export function useSavedOrders() {
  return useStored(STORAGE_KEYS.orders, readOrders, [] as SavedOrder[]);
}

/** Product ids bought before, most recent first (for "Order again"). */
export function boughtProductIds(orders: SavedOrder[]) {
  const seen = new Set<string>();
  for (const o of orders) for (const l of o.lines) seen.add(l.productId);
  return [...seen];
}

// ---------- Delivery PIN code ----------

export function getSavedPin(): string | null {
  const p = readText(STORAGE_KEYS.pincode);
  return isPincode(p) ? p : null;
}
export const savePin = (pin: string) => write(STORAGE_KEYS.pincode, pin);

export function useSavedPin() {
  return useStored(STORAGE_KEYS.pincode, getSavedPin, null as string | null);
}

// ---------- Coupon picked from the offer banner / checkout ----------

export function getSavedCoupon(): string | null {
  const c = readText(STORAGE_KEYS.coupon);
  return c && /^[A-Z0-9]{3,20}$/.test(c) ? c : null;
}
export const saveCoupon = (code: string | null) => write(STORAGE_KEYS.coupon, code);

// ---------- Checkout details (name, phone, address…) ----------

export const getSavedDetails = <T extends object>() => readJson<Partial<T> | null>(STORAGE_KEYS.checkoutDetails, null);
export const saveDetails = (d: object) => write(STORAGE_KEYS.checkoutDetails, d);

// ---------- One key per checkout attempt (no double orders) ----------

/** Same key until the order succeeds, even if the customer taps twice or reloads. */
export function checkoutAttemptKey(): string {
  const existing = readText(STORAGE_KEYS.idempotency, "session");
  if (existing) return existing;
  const k = crypto.randomUUID();
  write(STORAGE_KEYS.idempotency, k, "session");
  return k;
}
export const endCheckoutAttempt = () => remove(STORAGE_KEYS.idempotency, "session");
