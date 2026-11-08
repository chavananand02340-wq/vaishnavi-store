import { ok, originOf, readJson, route } from "@/server/http";
import { verifyPayment } from "@/server/payments";

/** POST /api/razorpay/verify: the customer's browser after Razorpay says "paid". */
export const POST = route("razorpay-verify", async (req) => {
  await verifyPayment(await readJson(req), originOf(req));
  return ok({});
});
