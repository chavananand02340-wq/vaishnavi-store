import type { Metadata } from "next";
import Link from "next/link";
import { requireTeam } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTeam();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-brand-700 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs opacity-80">{me.role === "owner" ? "Owner" : "Counter"} · Orders panel</p>
            <p className="font-semibold">{me.displayName ?? me.email}</p>
          </div>
          <div className="flex gap-2">
            {me.role === "owner" && (
              <Link href="/admin" className="btn border border-white/40 text-white">Admin</Link>
            )}
            <form action={signOut}>
              <button className="btn border border-white/40 text-white" type="submit">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
