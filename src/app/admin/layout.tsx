import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export const metadata: Metadata = { title: "Owner admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Home" },
  { href: "/staff", label: "Live orders" },
  { href: "/admin/orders", label: "All orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/settings", label: "Store & delivery" },
  { href: "/admin/pincodes", label: "PIN codes" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOwner();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-neutral-500">Owner admin</p>
            <p className="font-semibold">{me.displayName ?? me.email}</p>
          </div>
          <form action={signOut}>
            <button className="btn-ghost" type="submit">Log out</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-2" aria-label="Admin">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-neutral-700 hover:bg-brand-50">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
