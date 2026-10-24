"use client";

import { usePathname } from "next/navigation";
import { formatTime } from "@/lib/hours";
import { waLink } from "@/lib/cards";
import { Icon } from "@/components/Icon";
import { useCart } from "./cart";

export function StoreFooter() {
  const { settings: s } = useCart();
  const path = usePathname();
  if (!s || path === "/checkout" || path === "/cart" || path.startsWith("/order")) return null;
  const wa = waLink(s.whatsapp_number, `Hello ${s.store_name}, I want to place an order.`);

  return (
    <footer className="mt-auto bg-leaf-900 pb-28 text-white/80">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-display text-[24px] font-extrabold text-white">{s.store_name}</p>
          {s.tagline && <p className="mt-1 text-[15px]">{s.tagline}</p>}
          {s.address && <p className="mt-3 max-w-sm text-[15px] leading-relaxed">{s.address}</p>}
          <p className="mt-2 text-[15px]">
            Open {formatTime(s.open_time)} to {formatTime(s.close_time)}, every day
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {s.phone_primary && (
            <a href={`tel:+91${s.phone_primary}`} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-[15px] font-semibold text-white">
              <Icon name="phone" /> Call {s.phone_primary}
            </a>
          )}
          {wa && (
            <a href={wa} rel="noopener" className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-[15px] font-semibold text-white">
              <Icon name="chat" /> WhatsApp the shop
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
                <Icon name="star" /> Instagram
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
