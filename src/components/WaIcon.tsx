import { Icon } from "@/components/Icon";

/**
 * The WhatsApp mark used on every "WhatsApp us" button.
 * To use WhatsApp's official icon, put the file from WhatsApp's brand
 * resources at public/brand/whatsapp.svg and set USE_OFFICIAL to true.
 */
const USE_OFFICIAL = false;

export function WaIcon({ className = "size-5" }: { className?: string }) {
  if (USE_OFFICIAL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/brand/whatsapp.svg" alt="" aria-hidden className={className} />;
  }
  return <Icon name="chat" className={className} strokeWidth={2.4} />;
}
