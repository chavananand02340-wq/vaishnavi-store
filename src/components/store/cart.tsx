"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PublicSettings } from "@/lib/store-data";

/**
 * The cart lives in the customer's browser. Prices here are for display only —
 * the database re-prices everything at checkout.
 */
export type CartLine = {
  variantId: string;
  productId: string;
  name: string;
  label: string;
  price: number;
  image: string | null;
  qty: number;
  max: number;
};

type Ctx = {
  ready: boolean;
  lines: CartLine[];
  count: number;
  subtotal: number;
  settings: PublicSettings | null;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  updatePrice: (variantId: string, price: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  qtyOf: (variantId: string) => number;
};

const KEY = "vs-cart-v2";
export const MAX_QTY = 20;
const CartCtx = createContext<Ctx | null>(null);

function load(): CartLine[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is CartLine => l && typeof l.variantId === "string" && typeof l.qty === "number" && l.qty > 0)
      .slice(0, 60);
  } catch {
    return [];
  }
}

export function CartProvider({ children, settings }: { children: React.ReactNode; settings: PublicSettings | null }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(load());
    setReady(true);
    const onStorage = (e: StorageEvent) => e.key === KEY && setLines(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage blocked — cart still works this visit */
    }
  }, [lines, ready]);

  const cap = (max: number) => Math.max(0, Math.min(MAX_QTY, max));

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (existing) return prev.map((l) => (l.variantId === line.variantId ? { ...l, ...line, qty: Math.min(cap(line.max), l.qty + qty) } : l));
      if (cap(line.max) === 0) return prev;
      return [...prev, { ...line, qty: Math.min(cap(line.max), qty) }];
    });
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(qty, Math.max(1, cap(l.max))) } : l)),
    );
  }, []);

  const updatePrice = useCallback((variantId: string, price: number) => {
    setLines((prev) => prev.map((l) => (l.variantId === variantId && l.price !== price ? { ...l, price } : l)));
  }, []);

  const remove = useCallback((variantId: string) => setLines((prev) => prev.filter((l) => l.variantId !== variantId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((n, l) => n + l.qty * l.price, 0),
      settings,
      add,
      setQty,
      updatePrice,
      remove,
      clear,
      qtyOf: (id) => lines.find((l) => l.variantId === id)?.qty ?? 0,
    }),
    [ready, lines, settings, add, setQty, updatePrice, remove, clear],
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): Ctx {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
