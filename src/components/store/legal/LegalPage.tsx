import Link from "next/link";
import type { PublicSettings } from "@/lib/store-data";
import { StoreHeader } from "@/components/store/StoreHeader";
import { LEGAL_LINKS } from "@/lib/legal-links";

export const UPDATED = "25 October 2026";

/** Shop identity used across the policy pages. */
export function who(s: PublicSettings | null) {
  const name = s?.store_name ?? "Vaishnavi E-Mart";
  return {
    name,
    legal: s?.legal_name || name,
    address: s?.address || "Medical Chowk, Sawangi (Meghe), Wardha, Maharashtra 442001",
    phone: s?.phone_primary ? `+91 ${s.phone_primary}` : null,
    phone2: s?.phone_secondary ? `+91 ${s.phone_secondary}` : null,
    wa: s?.whatsapp_number ? `+91 ${s.whatsapp_number}` : null,
    email: s?.support_email || null,
  };
}

export function LegalPage({ title, path, children }: { title: string; path: string; children: React.ReactNode }) {
  return (
    <>
      <StoreHeader compact />
      <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-5">
        <nav aria-label="Policies" className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.href === path ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-semibold ring-1 ${l.href === path ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-ink ring-line"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <article className="rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-line sm:p-8">
          <h1 className="font-display text-[28px] font-extrabold leading-tight">{title}</h1>
          <p className="mt-1 text-[14px] text-muted">Last updated {UPDATED}</p>
          <div className="legal mt-6">{children}</div>
        </article>
      </main>
    </>
  );
}

export function ContactBlock({ s }: { s: PublicSettings | null }) {
  const w = who(s);
  return (
    <ul>
      <li><b>{w.legal}</b></li>
      <li>{w.address}</li>
      {w.phone && <li>Phone: <a href={`tel:${w.phone.replace(/\s/g, "")}`}>{w.phone}</a>{w.phone2 ? `, ${w.phone2}` : ""}</li>}
      {w.wa && <li>WhatsApp: {w.wa}</li>}
      {w.email && <li>Email: <a href={`mailto:${w.email}`}>{w.email}</a></li>}
    </ul>
  );
}
