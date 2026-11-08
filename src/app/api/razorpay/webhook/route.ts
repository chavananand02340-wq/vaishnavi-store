import { ok, originOf, route } from "@/server/http";
import { handleWebhook } from "@/server/payments";

/**
 * POST /api/razorpay/webhook (Razorpay → us). Always 200 for a valid signature
 * so Razorpay doesn't keep retrying events we don't use; 400 for a bad one.
 */
export const POST = route("razorpay-webhook", async (req) => {
  await handleWebhook(await req.text(), req.headers.get("x-razorpay-signature") ?? "", originOf(req));
  return ok({});
});
