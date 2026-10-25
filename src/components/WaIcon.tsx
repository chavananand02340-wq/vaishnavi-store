/** WhatsApp mark used on every "WhatsApp us" button. Use tone="white" on green buttons. */
export function WaIcon({ className = "size-5", tone = "white" }: { className?: string; tone?: "white" | "green" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={tone === "green" ? "/brand/whatsapp.png" : "/brand/whatsapp-white.png"} alt="" aria-hidden width={256} height={256} className={`shrink-0 ${className}`} />
  );
}
