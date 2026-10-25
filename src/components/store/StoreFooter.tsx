"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatTime } from "@/lib/hours";
import { waLink } from "@/lib/cards";
import { Icon } from "@/components/Icon";
import { WaIcon } from "@/components/WaIcon";
import { useCart } from "./cart";
import { LEGAL_LINKS } from "@/lib/legal-links";


export function StoreFooter() {
  const { settings: s } = useCart();
  const path = usePathname();
  if (!s || path === "/checkout" || path === "/cart" || path.startsWith("/order")) return null;
  const wa = waLink(s.whatsapp_number, `Hello ${s.store_name}, I want to place an order.`);

  return (
    <footer className="mt-auto bg-ink pb-28 text-white/75">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-9 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <span className="inline-block rounded-2xl bg-white px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt={s.store_name} width={800} height={380} className="h-16 w-auto" loading="lazy" />
          </span>
          {s.tagline && <p className="mt-3 text-[15px]">{s.tagline}</p>}
          {s.address && <p className="mt-3 max-w-sm text-[15px] leading-relaxed">{s.address}</p>}
          <p className="mt-2 text-[15px]">Open {formatTime(s.open_time)} to {formatTime(s.close_time)}, every day</p>
        </div>

        <div className="flex flex-col gap-2">
          {s.phone_primary && (
            <a href={`tel:+91${s.phone_primary}`} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-[15px] font-semibold text-white">
              <Icon name="phone" /> Call {s.phone_primary}
            </a>
          )}
          {wa && (
            <a href={wa} rel="noopener" className="flex items-center gap-3 rounded-xl bg-[#25d366] px-4 py-3 text-[15px] font-bold text-[#073b20]">
              <WaIcon /> WhatsApp us
            </a>
          )}
          <div className="flex gap-2">
            {s.maps_url && (
              <a href={s.maps_url} target="_blank" rel="noopener" className="flex flex-1 items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-[15px] font-semibold text-white">
                <Icon name="pin" /> Directions
              </a>
            )}
            {s.instagram_url && (
              <a href={s.instagram_url} target="_blank" rel="noopener" className="flex flex-1 items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-[15px] font-semibold text-white">
                <Icon name="camera" /> Instagram
              </a>
            )}
          </div>
        </div>

        <nav aria-label="Policies">
          <p className="mb-2 text-[15px] font-bold text-white">Help & policies</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[15px] md:grid-cols-1">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white hover:underline">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-1 px-4 py-4 text-[13px] text-white/55">
          <span>© {new Date().getFullYear()} {s.legal_name || s.store_name}</span>
          {s.fssai_number && <span>FSSAI Lic. No. {s.fssai_number}</span>}
          {s.gstin && <span>GSTIN {s.gstin}</span>}
          {s.support_email && <a href={`mailto:${s.support_email}`} className="underline">{s.support_email}</a>}
        </div>
      </div>
    </footer>
  );
}
