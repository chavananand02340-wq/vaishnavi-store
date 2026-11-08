import { AppError } from "@/lib/errors";

/** PIN code → district, state and post-office names, from India Post data (api.postalpincode.in). */

type PostOffice = { Name: string; District: string; State: string };
export type PincodeInfo = { city: string; state: string; areas: string[] };

/** Returns null if the PIN code doesn't exist. Throws "upstream" if the service is down or slow. */
export async function lookupPincode(pin: string, timeoutMs = 4000): Promise<PincodeInfo | null> {
  let r: Response;
  try {
    r = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "VaishnaviEMart/1.0" } });
  } catch (e) {
    throw new AppError("upstream", "PIN code lookup is not available right now.", { cause: e });
  }
  const j = (await r.json().catch(() => null)) as { Status: string; PostOffice: PostOffice[] | null }[] | null;
  if (!j) throw new AppError("upstream", "PIN code lookup is not available right now.");
  const offices = j[0]?.Status === "Success" ? (j[0].PostOffice ?? []) : [];
  if (!offices.length) return null;
  return { city: offices[0].District, state: offices[0].State, areas: [...new Set(offices.map((o) => o.Name))].slice(0, 12) };
}
