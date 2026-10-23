"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * The cart lives in the customer's browser (localStorage). Prices stored here
 * are for display only — the server re-prices everything at checkout.
 */
export type CartLine = {
  variantId: string;
  productId: string;
  name: string;
  label: string;
  price: number; // paise, display only
  image: string | null;
  qty: number;
  max: number; // stock when added (soft cap)
};

export type DeliveryInfo = {
  fee: number;
  freeEnabled: boolean;
  threshold: number;
};

type CartCtx = {
  ready: boolean;
  lines: CartLine[];
  count: number;
  subtotal: number;
  delivery: DeliveryInfo | null;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  qtyOf: (variantId: string) => number;
};

const KEY = "vs-cart-v1";
export const MAX_QTY = 20;
const Ctx = createContext<CartCtx | null>(null);

function load(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is CartLine =>
          l && typeof l.variantId === "string" && typeof l.qty === "number" && l.qty > 0 && typeof l.name === "string",
      )
      .slice(0, 60);
  } catch {
    return [];
  }
}

export function CartProvider({ children, delivery }: { children: React.ReactNode; delivery: DeliveryInfo | null }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(load());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setLines(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage full or blocked — cart still works for this visit */
    }
  }, [lines, ready]);

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    setLines((prev) => {
      const cap = Math.max(0, Math.min(MAX_QTY, line.max));
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === line.variantId ? { ...l, ...line, qty: Math.min(cap, l.qty + qty) } : l,
        );
      }
      if (cap === 0) return prev;
      return [...prev, { ...line, qty: Math.min(cap, qty) }];
    });
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(qty, Math.min(MAX_QTY, Math.max(1, l.max))) } : l)),
    );
  }, []);

  const remove = useCallback((variantId: string) => setLines((prev) => prev.filter((l) => l.variantId !== variantId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartCtx>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotal = lines.reduce((n, l) => n + l.qty * l.price, 0);
    return {
      ready,
      lines,
      count,
      subtotal,
      delivery,
      add,
      setQty,
      remove,
      clear,
      qtyOf: (id: string) => lines.find((l) => l.variantId === id)?.qty ?? 0,
    };
  }, [lines, ready, delivery, add, setQty, remove, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}

/** Updates the cached display price/stock of lines after a server quote. */
export function useSyncCartFromQuote() {
  const { lines, add } = useCart();
  return useCallback(
    (quoteLines: { variant_id: string; unit_price_paise: number }[]) => {
      for (const q of quoteLines) {
        const l = lines.find((x) => x.variantId === q.variant_id);
        if (l && l.price !== q.unit_price_paise) add({ ...l, price: q.unit_price_paise }, 0);
      }
    },
    [lines, add],
  );
}
