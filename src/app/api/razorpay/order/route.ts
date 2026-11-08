import { isUuid } from "@/lib/validation";
import { AppError } from "@/lib/errors";
import { ok, readJson, route } from "@/server/http";
import { AlreadyPaid, createPayment } from "@/server/payments";

/** POST /api/razorpay/order { token } → Razorpay checkout options for that order. */
export const POST = route("razorpay-order", async (req) => {
  const { token } = await readJson<{ token: string }>(req);
  if (!isUuid(token)) throw new AppError("invalid", "Bad request");
  try {
    return ok({ ...(await createPayment(token)) });
  } catch (e) {
    if (e instanceof AlreadyPaid) return Response.json({ ok: false, paid: true, message: "Already paid." });
    throw e;
  }
});
