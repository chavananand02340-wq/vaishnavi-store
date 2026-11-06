"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCart } from "./cart";

const ITEMS = [
  { href: "/", label: "Home", icon: "home", match: (p: string) => p === "/" },
  { href: "/categories", label: "Categories", icon: "grid", match: (p: string) => p.startsWith("/categories") || p.startsWith("/c/") },
  { href: "/search", label: "Search", icon: "search", match: (p: string) => p.startsWith("/search") },
  { href: "/cart", label: "Cart", icon: "cart", match: (p: string) => p.startsWith("/cart") },
  { href: "/orders", label: "Orders", icon: "orders", match: (p: string) => p.startsWith("/orders") || p.startsWith("/order") || p.startsWith("/favourites") },
];

/** Phone-only bottom menu, like quick-commerce apps. Hidden at checkout. */
export function BottomNav() {
  const path = usePathname();
  const { count, ready } = useCart();
  if (path === "/checkout") return null;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {ITEMS.map((it) => {
          const on = it.match(path);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11.5px] font-bold ${on ? "text-brand-700" : "text-muted"}`}>
                {on && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand-600" aria-hidden />}
                <span className="relative">
                  <Icon name={it.icon} className="size-6" strokeWidth={on ? 2.5 : 2} />
                  {it.href === "/cart" && ready && count > 0 && (
                    <span key={count} className="animate-pop absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-brand-600 px-1 text-center text-[11px] font-extrabold leading-[18px] text-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
