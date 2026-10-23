"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTeam } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  order_id: z.string().uuid(),
  to: z.enum(["confirmed", "out_for_delivery", "delivered"]),
});

/** Moves an order one step forward. Rules are enforced in the database. */
export async function advanceOrder(formData: FormData) {
  await requireTeam();
  const parsed = schema.safeParse({ order_id: formData.get("order_id"), to: formData.get("to") });
  if (!parsed.success) redirect("/staff?error=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_order_status", {
    p_order_id: parsed.data.order_id,
    p_to: parsed.data.to,
  });
  revalidatePath("/staff");
  if (error || !data?.ok) redirect(`/staff?error=${encodeURIComponent(data?.message ?? "Could not update order.")}`);
  redirect("/staff");
}

export async function markCashCollected(formData: FormData) {
  await requireTeam();
  const id = z.string().uuid().safeParse(formData.get("order_id"));
  if (!id.success) redirect("/staff?error=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_payment_status", { p_order_id: id.data, p_status: "paid" });
  revalidatePath("/staff");
  if (error || !data?.ok) redirect(`/staff?error=${encodeURIComponent(data?.message ?? "Could not update payment.")}`);
  redirect("/staff");
}
