"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner, requireTeam } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Where to go after an action: the panel, or an owner order page. */
function backTo(fd: FormData): string {
  const r = String(fd.get("return_to") ?? "");
  return /^\/(staff|admin\/orders(\/[0-9a-f-]{36})?)$/.test(r) ? r : "/staff";
}

function done(path: string, data: { ok?: boolean; message?: string } | null, error: unknown): never {
  revalidatePath("/staff");
  revalidatePath("/admin/orders", "layout");
  if (error || !data?.ok) {
    redirect(`${path}?error=${encodeURIComponent(data?.message ?? "Could not update. Please try again.")}`);
  }
  redirect(path);
}

const orderId = z.string().uuid();

/** Moves an order one step forward. Rules are enforced in the database. */
export async function advanceOrder(formData: FormData) {
  await requireTeam();
  const path = backTo(formData);
  const parsed = z
    .object({
      order_id: orderId,
      to: z.enum(["confirmed", "out_for_delivery", "delivered"]),
      eta: z.coerce.number().int().min(5).max(600).optional(),
    })
    .safeParse({
      order_id: formData.get("order_id"),
      to: formData.get("to"),
      eta: formData.get("eta") || undefined,
    });
  if (!parsed.success) redirect(`${path}?error=invalid`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_order_status", {
    p_order_id: parsed.data.order_id,
    p_to: parsed.data.to,
    p_eta_minutes: parsed.data.eta ?? null,
  });
  done(path, data, error);
}

export async function markCashCollected(formData: FormData) {
  await requireTeam();
  const path = backTo(formData);
  const id = orderId.safeParse(formData.get("order_id"));
  if (!id.success) redirect(`${path}?error=invalid`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_payment_status", { p_order_id: id.data, p_status: "paid" });
  done(path, data, error);
}

export async function markItemUnavailable(formData: FormData) {
  await requireTeam();
  const path = backTo(formData);
  const parsed = z
    .object({ order_id: orderId, item_id: z.coerce.number().int().positive() })
    .safeParse({ order_id: formData.get("order_id"), item_id: formData.get("item_id") });
  if (!parsed.success) redirect(`${path}?error=invalid`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_item_unavailable", {
    p_order_id: parsed.data.order_id,
    p_item_id: parsed.data.item_id,
  });
  done(path, data, error);
}

// ---------- Owner only ----------
export async function cancelOrder(formData: FormData) {
  await requireOwner();
  const path = backTo(formData);
  const parsed = z
    .object({ order_id: orderId, reason: z.string().trim().min(3).max(200) })
    .safeParse({ order_id: formData.get("order_id"), reason: formData.get("reason") });
  if (!parsed.success) redirect(`${path}?error=${encodeURIComponent("Write a short reason to cancel.")}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_order_status", {
    p_order_id: parsed.data.order_id,
    p_to: "cancelled",
    p_note: parsed.data.reason,
  });
  done(path, data, error);
}

export async function setPayment(formData: FormData) {
  await requireOwner();
  const path = backTo(formData);
  const parsed = z
    .object({ order_id: orderId, status: z.enum(["unpaid", "awaiting_verification", "paid"]) })
    .safeParse({ order_id: formData.get("order_id"), status: formData.get("status") });
  if (!parsed.success) redirect(`${path}?error=invalid`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_payment_status", {
    p_order_id: parsed.data.order_id,
    p_status: parsed.data.status,
  });
  done(path, data, error);
}
