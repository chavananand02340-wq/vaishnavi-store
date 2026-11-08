"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentMember, onSignedOut, signOut as endSession, type Member, type Role } from "@/services/admin/auth";
import { AppError, errorMessage } from "@/lib/errors";

export type { Role };
type Team = Member & { signOut: () => Promise<void> };

const Ctx = createContext<Team | null>(null);

/**
 * Who is using the shop panel. Checks the login stored on this phone, reads the
 * person's role once, and sends them to /login if they aren't allowed here.
 * All data is still protected by database rules; this only decides what to show.
 */
export function TeamProvider({ children, need }: { children: React.ReactNode; need: Role | "any" }) {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    await endSession();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    let alive = true;
    currentMember()
      .then((m) => {
        if (!alive) return;
        if (!m) return router.replace("/login");
        if (need === "owner" && m.role !== "owner") return router.replace("/staff");
        setTeam({ ...m, signOut });
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof AppError && e.code === "forbidden") return router.replace("/login?e=access");
        setProblem(errorMessage(e));
      });
    const stop = onSignedOut(() => router.replace("/login"));
    return () => {
      alive = false;
      stop();
    };
  }, [need, router, signOut]);

  if (problem) return <p className="p-6 text-center text-rose-700">{problem}</p>;
  if (!team) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page">
        <span className="size-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" aria-label="Loading" />
      </div>
    );
  }
  return <Ctx.Provider value={team}>{children}</Ctx.Provider>;
}

export function useTeam(): Team {
  const t = useContext(Ctx);
  if (!t) throw new Error("useTeam must be used inside TeamProvider");
  return t;
}
