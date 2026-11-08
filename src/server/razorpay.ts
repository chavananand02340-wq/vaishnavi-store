import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/config/server-env";
import { AppError } from "@/lib/errors";

/** Razorpay REST client and signature checks. Server only. */

export function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/** Constant-time compare (signatures). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function basicAuth(keyId: string, keySecret: string): string {
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export async function razorpay<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const e = serverEnv();
  if (!e.razorpayKeyId || !e.razorpayKeySecret) throw new AppError("not_configured", "Online payment is not set up yet.");
  const r = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: basicAuth(e.razorpayKeyId, e.razorpayKeySecret), "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }).catch((err) => {
    throw new AppError("upstream", "Couldn't reach Razorpay. Try again.", { cause: err });
  });
  const json = (await r.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!r.ok) throw new AppError("upstream", json.error?.description ?? `Razorpay error ${r.status}`);
  return json;
}
