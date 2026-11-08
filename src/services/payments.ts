"use client";



/** Customer-side online payment (Razorpay checkout popup + our /api/razorpay routes). */

export type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
export type RzpInstance = { open: () => void; close?: () => void; on: (e: string, f: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RzpInstance;
  }
}

export type CheckoutOptions = { key: string; order_id: string; amount: number; name: string; description: string; prefill: Record<string, string> };
export type StartResult = { ok: true; options: CheckoutOptions } | { ok: false; paid?: boolean; message: string };

let scriptJob: Promise<boolean> | null = null;

/** Loads Razorpay's checkout script once. */
export function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  scriptJob ??= new Promise<boolean>((resolve) => {
    const sc = document.createElement("script");
    sc.src = "https://checkout.razorpay.com/v1/checkout.js";
    sc.onload = () => resolve(true);
    sc.onerror = () => {
      scriptJob = null;
      resolve(false);
    };
    document.body.appendChild(sc);
  });
  return scriptJob;
}

async function post<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Asks our server to create the Razorpay order (amount comes from the database). */
export async function startPayment(token: string): Promise<StartResult> {
  const r = await post<{ ok: boolean; paid?: boolean; message?: string } & Partial<CheckoutOptions>>("/api/razorpay/order", { token });
  if (!r?.ok) return { ok: false, paid: r?.paid, message: r?.message ?? "Couldn't start payment. Try again." };
  const { key, order_id, amount, name, description, prefill } = r as CheckoutOptions;
  return { ok: true, options: { key, order_id, amount, name, description, prefill } };
}

/** After Razorpay says "paid": our server checks the signature and records it. */
export async function confirmPayment(resp: RzpResponse): Promise<{ ok: boolean; message?: string }> {
  return (await post<{ ok: boolean; message?: string }>("/api/razorpay/verify", resp)) ?? { ok: false };
}
