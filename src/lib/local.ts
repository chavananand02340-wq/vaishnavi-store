"use client";

import { useEffect, useState } from "react";

/**
 * Small per-phone memory (favourites, past orders). Lives only in this browser;
 * every read/write is wrapped because storage can be blocked.
 */
const EVT = "vs-local";

function read<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* blocked */
  }
  window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
}
function useLocal<T>(key: string, fallback: T): [T, boolean] {
  const [v, setV] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setV(read(key, fallback));
    setReady(true);
    const on = (e: Event) => {
      const k = e instanceof StorageEvent ? e.key : (e as CustomEvent<string>).detail;
      if (k === key) setV(read(key, fallback));
    };
    window.addEventListener("storage", on);
    window.addEventListener(EVT, on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener(EVT, on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [v, ready];
}

// ---------- Favourites ----------
const FAV = "vs-favs";
export function useFavourites() {
  const [ids, ready] = useLocal<string[]>(FAV, []);
  return {
    ids,
    ready,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => {
      const cur = read<string[]>(FAV, []);
      write(FAV, cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 100));
      return !cur.includes(id);
    },
  };
}

// ---------- Orders placed from this phone ----------
export type SavedLine = { variantId: string; productId: string; name: string; label: string; price: number; image: string | null; qty: number };
export type SavedOrder = { token: string; no: number; at: string; total: number; lines: SavedLine[] };
const ORD = "vs-orders";

export function saveOrder(o: SavedOrder) {
  const cur = read<SavedOrder[]>(ORD, []).filter((x) => x.token !== o.token);
  write(ORD, [o, ...cur].slice(0, 30));
}
export function useSavedOrders() {
  return useLocal<SavedOrder[]>(ORD, []);
}
/** Product ids bought before, most recent first (for "Order again"). */
export function boughtProductIds(orders: SavedOrder[]) {
  const seen = new Set<string>();
  for (const o of orders) for (const l of o.lines) seen.add(l.productId);
  return [...seen];
}
