import { isUuid } from "@/lib/validation";
import { AppError } from "@/lib/errors";
import { originOf, readJson, route } from "@/server/http";
import { sendOrderEmails } from "@/server/email/send";

/**
 * POST /api/order-email { token, event?: "placed" | "packing" }
 * The browser only sends the order's tracking token; details come from the database,
 * which hands them out once per event and only with NOTIFY_SECRET.
 * Unknown or already-emailed orders answer { ok: false } with status 200.
 */
export const POST = route("order-email", async (req) => {
  const b = await readJson<{ token: string; event: string }>(req);
  if (!isUuid(b.token)) throw new AppError("invalid", "Bad request");
  return Response.json(await sendOrderEmails(b.token, b.event === "packing" ? "packing" : "placed", originOf(req)));
});
