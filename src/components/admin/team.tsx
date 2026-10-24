"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/browser";

export type Role = "owner" | "staff";
type Team = { user: User; role: Role; name: string; signOut: () => Promise<void> };

const Ctx = createContext<Team | null>(null);

/**
 * Checks the login stored on this phone (no network needed), then reads the
 * person's role once. All data access is still protected by database rules.
 */
export function TeamProvider({ children, need }: { children: React.ReactNode; need: Role | "any" }) {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = supabase();
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return router.replace("/login");
      const { data: row, error } = await sb.from("admin_users").select("role, display_name, is_active").eq("user_id", user.id).maybeSingle();
      if (!alive) return;
      if (error) return setProblem("Couldn't reach the database. Check your internet and refresh.");
      if (!row || !row.is_active) {
        await sb.auth.signOut();
        return router.replace("/login?e=access");
      }
      const role = row.role as Role;
      if (need === "owner" && role !== "owner") return router.replace("/staff");
      setTeam({ user, role, name: (row.display_name as string | null) ?? user.email ?? "", signOut });
    })();
    const { data: sub } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [need, router, signOut]);

  if (problem) return <p className="p-6 text-center text-rose-700">{problem}</p>;
  if (!team) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page">
        <span className="size-10 animate-spin rounded-full border-4 border-leaf-100 border-t-leaf-700" aria-label="Loading" />
      </div>
    );
  }
  return <Ctx.Provider value={team}>{children}</Ctx.Provider>;
}

export function useTeam(): Team {
  const t = useContext(Ctx);
  if (!t) throw new Error("useTeam outside TeamProvider");
  return t;
}

/** Tell the CDN to refresh store pages now (owner only; fire and forget). */
export async function refreshStorefront() {
  try {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    void fetch("/api/revalidate", { method: "POST", headers: { Authorization: `Bearer ${token}` }, keepalive: true });
  } catch {
    /* the store refreshes on its own within a minute */
  }
}
