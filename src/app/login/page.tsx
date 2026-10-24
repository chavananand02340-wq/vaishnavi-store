"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { Icon } from "@/components/Icon";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("e") === "access" ? "This account doesn't have access. Ask the shop owner." : null);

  // Already signed in on this phone? Go straight to the right panel.
  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data } = await sb.auth.getSession();
      if (!data.session) return;
      const { data: row } = await sb.from("admin_users").select("role, is_active").eq("user_id", data.session.user.id).maybeSingle();
      if (row?.is_active) router.replace(row.role === "owner" ? "/admin" : "/staff");
    })();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const sb = supabase();
    const { data, error: err } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (err || !data.user) {
      setBusy(false);
      setError(err?.message?.toLowerCase().includes("fetch") ? "No internet connection. Try again." : "Wrong email or password.");
      return;
    }
    const { data: row } = await sb.from("admin_users").select("role, is_active").eq("user_id", data.user.id).maybeSingle();
    if (!row?.is_active) {
      await sb.auth.signOut();
      setBusy(false);
      setError("This account doesn't have access. Ask the shop owner.");
      return;
    }
    router.replace(row.role === "owner" ? "/admin" : "/staff");
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-6 shadow-[0_20px_50px_-25px_rgba(8,42,27,.45)]">
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-[15px] font-semibold text-rose-800" role="alert">{error}</p>}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <div className="relative">
          <input
            id="password"
            className="field pr-20"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[14px] font-semibold text-leaf-700">
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <button type="submit" className="btn-leaf w-full text-[17px]" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-leaf-700">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
        <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-haldi-500 text-leaf-900">
          <Icon name="store" className="size-7" strokeWidth={2.2} />
        </span>
        <h1 className="font-display text-[32px] font-extrabold leading-tight text-white">Vaishnavi Store</h1>
        <p className="mb-6 mt-1 text-[16px] text-white/80">Owner and counter login</p>
        <Suspense fallback={<div className="h-80 rounded-3xl bg-white" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
