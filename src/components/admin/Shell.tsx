"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { Icon } from "@/components/Icon";
import { HUE, type Hue } from "./ui";
import { useTeam } from "./team";

type Item = { href: string; label: string; icon: string; hue: Hue; tab?: boolean };

const OWNER_NAV: Item[] = [
  { href: "/admin", label: "Home", icon: "home", hue: "home", tab: true },
  { href: "/staff", label: "Live orders", icon: "bell", hue: "live", tab: true },
  { href: "/admin/products", label: "Products", icon: "box", hue: "products", tab: true },
  { href: "/admin/orders", label: "All orders", icon: "orders", hue: "orders", tab: true },
  { href: "/admin/categories", label: "Categories", icon: "tag", hue: "categories" },
  { href: "/admin/coupons", label: "Coupons", icon: "percent", hue: "coupons" },
  { href: "/admin/banners", label: "Banners", icon: "gift", hue: "banners" },
  { href: "/admin/pincodes", label: "PIN codes", icon: "pin", hue: "pincodes" },
  { href: "/admin/settings", label: "Shop settings", icon: "settings", hue: "settings" },
];

function isActive(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`) || (href === "/admin/orders" && path === "/admin/order");
}

/** Number of orders waiting in "New", kept live for the menu badge. */
function useNewCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const sb = supabase();
    const load = async () => {
      const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "new");
      setN(count ?? 0);
    };
    void load();
    const ch = sb
      .channel("menu-new-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void load())
      .subscribe();
    const t = setInterval(load, 60_000);
    return () => {
      clearInterval(t);
      void sb.removeChannel(ch);
    };
  }, []);
  return n;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { role, name, signOut } = useTeam();
  const path = usePathname();
  const [more, setMore] = useState(false);
  const newCount = useNewCount();
  const isOwner = role === "owner";
  const nav = isOwner ? OWNER_NAV : [];
  const tabs = nav.filter((n) => n.tab);
  const extra = nav.filter((n) => !n.tab);
  const current = nav.find((n) => isActive(path, n.href));

  useEffect(() => setMore(false), [path]);

  const badge = (href: string) =>
    href === "/staff" && newCount > 0 ? (
      <span className="ml-auto flex min-w-6 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[13px] font-extrabold text-amber-950">{newCount}</span>
    ) : null;

  return (
    <div className="min-h-dvh bg-page lg:flex">
      {/* Desktop sidebar */}
      {isOwner && (
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
          <div className="px-5 pb-4 pt-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-compact.png" alt="Vaishnavi E-Mart" width={403} height={144} className="h-11 w-auto" />
            <p className="mt-1.5 text-[13px] font-semibold text-muted">Owner panel</p>
          </div>
          <nav className="flex-1 space-y-1 px-3" aria-label="Owner menu">
            {nav.map((n) => {
              const active = isActive(path, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] font-semibold ${active ? `${HUE[n.hue].soft}` : "text-ink hover:bg-page"}`}
                >
                  <span className={`flex size-8 items-center justify-center rounded-lg ${active ? HUE[n.hue].solid : `${HUE[n.hue].soft}`}`}>
                    <Icon name={n.icon} className="size-[18px]" strokeWidth={2.2} />
                  </span>
                  {n.label}
                  {badge(n.href)}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line p-3">
            <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] font-semibold hover:bg-page">
              <Icon name="store" className="size-5 text-muted" /> View store
            </Link>
            <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] font-semibold text-rose-700 hover:bg-rose-50">
              <Icon name="logout" className="size-5" /> Log out
            </button>
            <p className="px-2.5 pt-2 text-[12px] text-muted">{name}</p>
          </div>
        </aside>
      )}

      <div className="min-w-0 flex-1">
        {/* Mobile / staff top bar */}
        <header className={`sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur ${isOwner ? "lg:hidden" : ""}`}>
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-compact.png" alt="Vaishnavi E-Mart" width={403} height={144} className="h-9 w-auto shrink-0" />
            <span className="min-w-0 flex-1 border-l border-line pl-3">
              <span className="block truncate text-[14px] font-bold leading-tight">{isOwner ? (current?.label ?? "Owner panel") : "Counter, live orders"}</span>
            </span>
            {!isOwner && (
              <button type="button" onClick={signOut} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[14px] font-semibold text-rose-700 hover:bg-rose-50">
                <Icon name="logout" className="size-5" /> Log out
              </button>
            )}
          </div>
        </header>

        <main className={`mx-auto max-w-5xl px-4 pt-5 ${isOwner ? "pb-28 lg:pb-10" : "pb-10"}`}>{children}</main>
      </div>

      {/* Mobile bottom tabs (owner) */}
      {isOwner && (
        <nav aria-label="Owner menu" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {tabs.map((n) => {
              const active = isActive(path, n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className="relative flex flex-col items-center gap-0.5 py-2">
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${active ? HUE[n.hue].solid : "text-muted"}`}>
                    <Icon name={n.icon} className="size-[20px]" strokeWidth={2.2} />
                  </span>
                  <span className={`text-[11.5px] font-bold ${active ? HUE[n.hue].text : "text-muted"}`}>{n.label}</span>
                  {n.href === "/staff" && newCount > 0 && (
                    <span className="absolute right-[18%] top-1 flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-extrabold text-amber-950 ring-2 ring-white">
                      {newCount}
                    </span>
                  )}
                </Link>
              );
            })}
            <button type="button" onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2" aria-haspopup="dialog">
              <span className={`flex h-8 w-12 items-center justify-center rounded-full ${extra.some((n) => isActive(path, n.href)) ? HUE.settings.solid : "text-muted"}`}>
                <Icon name="menu" className="size-[20px]" strokeWidth={2.2} />
              </span>
              <span className="text-[11.5px] font-bold text-muted">More</span>
            </button>
          </div>
        </nav>
      )}

      {/* "More" sheet */}
      {isOwner && more && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setMore(false)} />
          <div className="animate-pop absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="grid grid-cols-4 gap-2">
              {extra.map((n) => (
                <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-2 rounded-2xl p-3 text-center ring-1 ${HUE[n.hue].soft} ${HUE[n.hue].ring}`}>
                  <span className={`flex size-11 items-center justify-center rounded-xl ${HUE[n.hue].solid}`}>
                    <Icon name={n.icon} className="size-5" strokeWidth={2.2} />
                  </span>
                  <span className="text-[13.5px] font-bold leading-tight">{n.label}</span>
                </Link>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/" target="_blank" className="btn-plain">
                <Icon name="store" /> View store
              </Link>
              <button type="button" onClick={signOut} className="btn-danger">
                <Icon name="logout" /> Log out
              </button>
            </div>
            <p className="mt-3 text-center text-[12px] text-muted">Signed in as {name}</p>
          </div>
        </div>
      )}
    </div>
  );
}
