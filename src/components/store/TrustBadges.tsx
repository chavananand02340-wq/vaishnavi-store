import { Icon } from "@/components/ui/Icon";

/**
 * Plain text badges (no third-party logos): how customers can pay, and why it is safe.
 */
export function TrustBadges({ online, cod = true, fssai, compact = false, dark = false }: { online: boolean; cod?: boolean; fssai?: string | null; compact?: boolean; dark?: boolean }) {
  const pill = dark ? "bg-white/10 text-white ring-white/15" : "bg-white text-ink ring-line";
  const items = [
    ...(online
      ? [
          { icon: "rupee", text: "UPI apps" },
          { icon: "card", text: "Debit / credit cards" },
          { icon: "bank", text: "Net banking" },
        ]
      : []),
    ...(cod ? [{ icon: "truck", text: "Cash on delivery" }] : []),
  ];
  return (
    <div className={compact ? "" : "space-y-3"}>
      <div className={`flex flex-wrap gap-1.5 ${compact ? "justify-center" : ""}`}>
        {items.map((b) => (
          <span key={b.text} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ${pill}`}>
            <Icon name={b.icon} className="size-3.5" strokeWidth={2.2} /> {b.text}
          </span>
        ))}
      </div>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] font-semibold ${compact ? "mt-2 justify-center" : ""} ${dark ? "text-white/70" : "text-muted"}`}>
        {online && (
          <span className="inline-flex items-center gap-1.5">
            <Icon name="shield" className={`size-4 ${dark ? "text-emerald-300" : "text-emerald-600"}`} strokeWidth={2.2} /> Payments secured by Razorpay
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Icon name="check" className={`size-4 ${dark ? "text-emerald-300" : "text-emerald-600"}`} strokeWidth={2.6} /> {fssai ? "FSSAI licensed shop" : "Trusted local shop"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="store" className={`size-4 ${dark ? "text-emerald-300" : "text-emerald-600"}`} strokeWidth={2.2} /> 100% original products
        </span>
      </div>
    </div>
  );
}
