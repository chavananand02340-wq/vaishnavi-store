"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { submitUtr } from "@/app/(store)/actions";

/** Refreshes the order page every 45 s while the order is still moving. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 45_000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}

export function UtrForm({ token, existing }: { token: string; existing: string | null }) {
  const router = useRouter();
  const [utr, setUtr] = useState(existing ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitUtr(token, utr);
          setMsg(r.ok ? { ok: true, text: "Thanks! The store will confirm your payment shortly." } : { ok: false, text: r.message ?? "Could not save." });
          if (r.ok) router.refresh();
        });
      }}
    >
      <label className="label" htmlFor="utr">After paying, enter the UPI reference / UTR number (optional)</label>
      <div className="flex gap-2">
        <input
          id="utr"
          className="field"
          inputMode="numeric"
          value={utr}
          onChange={(e) => setUtr(e.target.value.slice(0, 30))}
          placeholder="12-digit number"
        />
        <button className="btn-primary shrink-0" type="submit" disabled={pending || utr.trim().length < 6}>
          {pending ? "…" : "Send"}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-brand-700" : "text-red-700"}`}>{msg.text}</p>}
    </form>
  );
}
