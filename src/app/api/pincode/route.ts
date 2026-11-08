import { isPincode } from "@/lib/validation";
import { AppError } from "@/lib/errors";
import { ok, route } from "@/server/http";
import { lookupPincode } from "@/server/pincode";

export const dynamic = "force-dynamic";

/** GET /api/pincode?pin=442001 → { ok, city, state, areas } (checkout fills city and state from it). */
export const GET = route("pincode", async (req) => {
  const pin = new URL(req.url).searchParams.get("pin") ?? "";
  if (!isPincode(pin)) throw new AppError("invalid", "Enter a 6-digit PIN code.");
  const info = await lookupPincode(pin).catch(() => undefined);
  if (info === undefined) return Response.json({ ok: false, reason: "lookup_failed" });
  if (info === null) return Response.json({ ok: false }, { headers: { "Cache-Control": "public, max-age=86400" } });
  return ok(info, { headers: { "Cache-Control": "public, max-age=604800" } });
});
