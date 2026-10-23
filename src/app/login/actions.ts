"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(200),
});

export async function signIn(formData: FormData) {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) redirect("/login?error=invalid");

  const { data: member } = await supabase
    .from("admin_users")
    .select("role, is_active")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!member || !member.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=not_authorised");
  }

  redirect(member.role === "owner" ? "/admin" : "/staff");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
