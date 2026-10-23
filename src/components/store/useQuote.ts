"use client";

import { useEffect, useRef, useState } from "react";
import { getQuote, type Quote, type QuoteError } from "@/app/(store)/actions";
import { useCart } from "./cart";

/** Asks the server to price the current cart (debounced). */
export function useQuote(pincode: string | null) {
  const { lines, ready } = useCart();
  const [quote, setQuote] = useState<Quote | QuoteError | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const key = JSON.stringify(lines.map((l) => [l.variantId, l.qty])) + "|" + (pincode ?? "");

  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0) {
      setQuote(null);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const q = await getQuote(
          lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
          pincode,
        );
        if (mine === seq.current) setQuote(q);
      } catch {
        if (mine === seq.current) setQuote({ ok: false, code: "network", message: "No internet connection. Retrying when you change something." });
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  return { quote, loading, setQuote };
}
