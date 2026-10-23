import Link from "next/link";
import { CartProvider } from "@/components/store/cart";
import { CartBar, CartIcon } from "@/components/store/CartBar";
import { formatTime, getSettings, getStoreOpen, whatsappLink } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [s, open] = await Promise.all([getSettings(), getStoreOpen()]);
  const delivery = s
    ? { fee: s.delivery_fee_paise, freeEnabled: s.free_delivery_enabled, threshold: s.free_delivery_threshold_paise }
    : null;
  const wa = whatsappLink(s?.whatsapp_number, "Hello, I want to order from Vaishnavi Store.");

  return (
    <CartProvider delivery={delivery}>
      <header className="sticky top-0 z-20 bg-brand-700 text-white shadow">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 pb-2 pt-3">
          <Link href="/" className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold leading-tight">{s?.store_name ?? "Vaishnavi Store"}</p>
            {s && (
              <p className="truncate text-xs text-white/80">
                {open ? `Delivery in ~${s.default_eta_minutes} min` : "Closed now"} · {formatTime(s.open_time)}–{formatTime(s.close_time)}
              </p>
            )}
          </Link>
          <CartIcon />
        </div>
        <form action="/search" className="mx-auto max-w-5xl px-3 pb-3" role="search">
          <input
            name="q"
            type="search"
            enterKeyHint="search"
            placeholder="Search atta, oil, biscuits…"
            aria-label="Search products"
            className="w-full rounded-lg border-0 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none"
          />
        </form>
      </header>

      {s && !open && (
        <div className="bg-amber-50 px-3 py-2 text-center text-sm text-amber-900">
          {s.closed_message ?? `We're closed right now. Orders open at ${formatTime(s.open_time)}.`} You can still browse and fill your cart.
        </div>
      )}
      {s?.announcement && open && (
        <div className="bg-brand-50 px-3 py-2 text-center text-sm text-brand-800">{s.announcement}</div>
      )}

      <div className="mx-auto max-w-5xl px-3 pb-36 pt-4">{children}</div>

      <footer className="border-t border-neutral-200 bg-white px-3 pb-32 pt-6 text-sm text-neutral-600">
        <div className="mx-auto max-w-5xl space-y-1">
          <p className="font-semibold text-neutral-800">{s?.store_name ?? "Vaishnavi Store"}</p>
          {s?.address && <p>{s.address}</p>}
          {s && <p>Open {formatTime(s.open_time)} – {formatTime(s.close_time)}</p>}
          <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            {s?.phone_primary && <a className="underline" href={`tel:+91${s.phone_primary}`}>Call {s.phone_primary}</a>}
            {wa && <a className="underline" href={wa} rel="noopener">WhatsApp</a>}
            {s?.maps_url && <a className="underline" href={s.maps_url} rel="noopener" target="_blank">Directions</a>}
            {s?.instagram_url && <a className="underline" href={s.instagram_url} rel="noopener" target="_blank">Instagram</a>}
          </p>
          {s?.cod_enabled && <p className="pt-2 text-xs text-neutral-400">Cash on Delivery available on every order.</p>}
        </div>
      </footer>
      <CartBar />
    </CartProvider>
  );
}
