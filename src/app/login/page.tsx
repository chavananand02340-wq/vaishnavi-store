import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTeamMember } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { Notice } from "@/components/Notice";
import { SubmitButton } from "@/components/SubmitButton";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Login", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  invalid: "Wrong email or password.",
  not_authorised: "This account does not have access. Ask the store owner.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-sm px-5 py-16">
        <Notice error="Supabase is not connected yet. Add the environment variables from .env.example." />
      </main>
    );
  }

  const member = await getTeamMember();
  if (member) redirect(member.role === "owner" ? "/admin" : "/staff");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="mb-1 text-2xl font-bold">Store login</h1>
      <p className="mb-6 text-sm text-neutral-600">For the owner and counter staff only.</p>
      <Notice error={error ? (ERRORS[error] ?? "Could not sign in.") : null} />
      <form action={signIn} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="field" id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="field" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required />
        </div>
        <SubmitButton pendingText="Signing in…" className="btn-primary w-full">Sign in</SubmitButton>
      </form>
    </main>
  );
}
