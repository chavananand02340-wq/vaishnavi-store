import { EMAIL_RE, isMobile, isPincode } from "@/lib/validation";

/** Customer details form at checkout: shape, checks and the address sent to the shop. Pure. */

export type Details = { name: string; phone: string; email: string; address: string; landmark: string; pincode: string; city: string; state: string; instructions: string };
export const EMPTY_DETAILS: Details = { name: "", phone: "", email: "", address: "", landmark: "", pincode: "", city: "", state: "", instructions: "" };

/** "+91 98765 43210", "098765…" → "9876543210". */
export function normalizeMobile(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
}

/** House + street as typed, then city and state (if not already written), max 300 characters. */
export function fullAddress(d: Pick<Details, "address" | "city" | "state">): string {
  let a = d.address.trim().replace(/^,\s*/, "");
  for (const part of [d.city.trim(), d.state.trim()]) {
    if (part && !a.toLowerCase().includes(part.toLowerCase())) a += `, ${part}`;
  }
  return a.slice(0, 300);
}

export type DetailErrors = Record<"name" | "phone" | "email" | "address" | "pincode", string | null>;

/** What the customer still has to fix (null = fine). */
export function checkDetails(d: Details): DetailErrors {
  return {
    name: d.name.trim().length < 2 ? "Enter your name" : null,
    phone: !isMobile(normalizeMobile(d.phone)) ? "Enter a 10-digit mobile number" : null,
    email: d.email.trim() && !EMAIL_RE.test(d.email.trim()) ? "Check your email address" : null,
    address: d.address.trim().length < 5 ? "Enter house number, building and street" : null,
    pincode: !isPincode(d.pincode) ? "Enter a 6-digit PIN code" : null,
  };
}

/** Details worth remembering on this phone for next time (not the one-off note). */
export function detailsToRemember(d: Details): Omit<Details, "instructions"> {
  const { instructions: _note, ...keep } = d;
  void _note;
  return keep;
}
