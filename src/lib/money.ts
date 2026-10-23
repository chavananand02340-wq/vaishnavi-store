/** All amounts in the database are integer paise (₹1 = 100 paise). */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatPaise(paise: number): string {
  return inr.format(paise / 100);
}

/** "349", "349.50", "₹ 1,200" → paise. Returns null for anything invalid. */
export function rupeesToPaise(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/[₹,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function paiseToRupeesInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}
