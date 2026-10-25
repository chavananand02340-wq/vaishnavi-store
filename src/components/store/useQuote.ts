"use client";

import { useEffect, useRef, useState } from "react";
import { getQuote, type Quote, type QuoteError } from "@/lib/checkout";
import { useCart } from "./cart";

/** Re-prices the cart on the server whenever it (or the PIN) changes. */
export function useQuote(pincode: string | null, coupon: string | null = null) {
  const { lines, ready, updatePrice } = useCart();
  const [quote, setQuote] = useState<Quote | QuoteError | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const key = JSON.stringify(lines.map((l) => [l.variantId, l.qty])) + "|" + (pincode ?? "") + "|" + (coupon ?? "");

  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0) {
      setQuote(null);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const q = await getQuote(lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })), pincode, coupon);
      if (mine !== seq.current) return;
      setQuote(q);
      setLoading(false);
      if (q.ok) q.lines.forEach((l) => updatePrice(l.variant_id, l.unit_price_paise));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  return { quote, loading, setQuote };
}
