"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";

/**
 * One colour per kind of work, used everywhere (menu, tiles, buttons, status pills),
 * so the owner and counter staff learn "amber = new order" once.
 */
export const HUE = {
  home: { solid: "bg-brand-700 text-white", soft: "bg-brand-50 text-brand-800", ring: "ring-brand-200", text: "text-brand-700" },
  live: { solid: "bg-amber-500 text-amber-950", soft: "bg-amber-50 text-amber-900", ring: "ring-amber-200", text: "text-amber-700" },
  orders: { solid: "bg-indigo-600 text-white", soft: "bg-indigo-50 text-indigo-900", ring: "ring-indigo-200", text: "text-indigo-700" },
  products: { solid: "bg-teal-600 text-white", soft: "bg-teal-50 text-teal-900", ring: "ring-teal-200", text: "text-teal-700" },
  categories: { solid: "bg-fuchsia-600 text-white", soft: "bg-fuchsia-50 text-fuchsia-900", ring: "ring-fuchsia-200", text: "text-fuchsia-700" },
  pincodes: { solid: "bg-sky-600 text-white", soft: "bg-sky-50 text-sky-900", ring: "ring-sky-200", text: "text-sky-700" },
  settings: { solid: "bg-slate-700 text-white", soft: "bg-slate-100 text-slate-900", ring: "ring-slate-200", text: "text-slate-700" },
  banners: { solid: "bg-orange-500 text-white", soft: "bg-orange-50 text-orange-900", ring: "ring-orange-200", text: "text-orange-700" },
  coupons: { solid: "bg-emerald-600 text-white", soft: "bg-emerald-50 text-emerald-900", ring: "ring-emerald-200", text: "text-emerald-700" },
  danger: { solid: "bg-rose-600 text-white", soft: "bg-rose-50 text-rose-900", ring: "ring-rose-200", text: "text-rose-700" },
} as const;
export type Hue = keyof typeof HUE;

export const STATUS: Record<string, { label: string; pill: string; button: string }> = {
  new: { label: "New", pill: "bg-amber-100 text-amber-900 ring-amber-300", button: "bg-amber-500 text-amber-950 hover:bg-amber-400" },
  confirmed: { label: "Packing", pill: "bg-blue-100 text-blue-900 ring-blue-300", button: "bg-blue-600 text-white hover:bg-blue-700" },
  out_for_delivery: { label: "On the way", pill: "bg-violet-100 text-violet-900 ring-violet-300", button: "bg-violet-600 text-white hover:bg-violet-700" },
  delivered: { label: "Delivered", pill: "bg-emerald-100 text-emerald-900 ring-emerald-300", button: "bg-emerald-600 text-white hover:bg-emerald-700" },
  cancelled: { label: "Cancelled", pill: "bg-rose-100 text-rose-900 ring-rose-300", button: "bg-rose-600 text-white hover:bg-rose-700" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.new;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-bold ring-1 ${s.pill}`}>{s.label}</span>;
}

export function PageTitle({ title, hue, icon, action }: { title: string; hue: Hue; icon: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${HUE[hue].solid}`}>
        <Icon name={icon} className="size-5" strokeWidth={2.2} />
      </span>
      <h1 className="flex-1 font-display text-[24px] font-bold leading-tight">{title}</h1>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-4 ring-1 ring-line ${className}`}>{children}</section>;
}

export function CardTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[17px] font-bold">{children}</h2>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  id,
  className = "",
  ...props
}: { label: string; hint?: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      <input className="field" id={id} {...props} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** Big, obvious on/off switch. */
export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl py-1 text-left disabled:opacity-50"
    >
      <span className="flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        {hint && <span className="hint block">{hint}</span>}
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-brand-600" : "bg-neutral-300"}`}>
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${checked ? "left-7" : "left-1"}`} />
      </span>
    </button>
  );
}

export function Tile({ href, hue, icon, title, value, note }: { href: string; hue: Hue; icon: string; title: string; value?: string; note?: string }) {
  return (
    <Link href={href} className={`group flex flex-col rounded-2xl p-4 ring-1 transition active:scale-[.98] ${HUE[hue].soft} ${HUE[hue].ring}`}>
      <span className={`flex size-10 items-center justify-center rounded-xl ${HUE[hue].solid}`}>
        <Icon name={icon} className="size-5" strokeWidth={2.2} />
      </span>
      {value != null && <span className="mt-3 font-display text-[28px] font-extrabold leading-none">{value}</span>}
      <span className={`text-[15px] font-bold ${value != null ? "mt-1" : "mt-3"}`}>{title}</span>
      {note && <span className="text-[13px] opacity-80">{note}</span>}
    </Link>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-10 text-center ring-1 ring-line">
      <span className="flex size-14 items-center justify-center rounded-full bg-page text-muted">
        <Icon name={icon} className="size-7" />
      </span>
      <p className="mt-3 text-[17px] font-bold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[15px] text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <span className="size-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" aria-label="Loading" />
    </div>
  );
}

export function ErrorBox({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="rounded-2xl bg-rose-50 p-4 text-rose-900 ring-1 ring-rose-200">
      <p className="font-semibold">{text}</p>
      {retry && (
        <button type="button" onClick={retry} className="mt-2 font-bold underline">
          Try again
        </button>
      )}
    </div>
  );
}
