import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type TeamRole = "owner" | "staff";
export type TeamMember = { userId: string; email: string | null; role: TeamRole; displayName: string | null };

/** Returns the signed-in team member, or null if not signed in / not on the team. */
export async function getTeamMember(): Promise<TeamMember | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("admin_users")
    .select("role, display_name, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data || !data.is_active) return null;
  return { userId: user.id, email: user.email ?? null, role: data.role as TeamRole, displayName: data.display_name };
}

/** Owner-only pages. Staff are sent to their own panel. */
export async function requireOwner(): Promise<TeamMember> {
  const member = await getTeamMember();
  if (!member) redirect("/login?error=not_authorised");
  if (member.role !== "owner") redirect("/staff");
  return member;
}

/** Staff panel: owner or staff. */
export async function requireTeam(): Promise<TeamMember> {
  const member = await getTeamMember();
  if (!member) redirect("/login?error=not_authorised");
  return member;
}
