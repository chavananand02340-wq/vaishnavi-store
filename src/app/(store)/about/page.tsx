import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/store-data";
import { formatTime } from "@/lib/hours";
import { formatPaise } from "@/lib/money";
import { ContactBlock, LegalPage, who } from "@/components/store/legal/LegalPage";

export const metadata: Metadata = { title: "About us", alternates: { canonical: "/about" } };

export default async function AboutPage() {
  const s = await getSettings();
  const w = who(s);
  return (
    <LegalPage title={`About ${w.name}`} path="/about">
      <p>
        {w.name} is a neighbourhood grocery and daily-needs store in Wardha. For years families nearby have bought their atta, dal, rice, oil,
        masale, snacks and household items from our counter. This website lets you do the same from your phone: pick what you need and we
        bring it to your door, usually in about {s?.default_eta_minutes ?? 30} minutes.
      </p>
      <h2>How it works</h2>
      <ol>
        <li>Choose products and pack sizes. Prices you see are the shop&apos;s current prices.</li>
        <li>Place the order with your address and mobile number. No account or password needed.</li>
        <li>We confirm, pack and deliver. Pay cash on delivery{s?.upi_enabled ? " or by UPI" : ""}.</li>
      </ol>
      <p>
        Delivery is {s?.free_delivery_enabled ? `free on orders of ${formatPaise(s.free_delivery_threshold_paise)} and above, and ${formatPaise(s.delivery_fee_paise)} below that` : `${formatPaise(s?.delivery_fee_paise ?? 3000)} per order`}.
        Need a bigger quantity than the packs listed? Message us on WhatsApp and we will arrange it.
      </p>
      <h2>Opening hours</h2>
      <p>Every day, {formatTime(s?.open_time ?? "10:00")} to {formatTime(s?.close_time ?? "22:00")}.</p>
      <h2>Find us</h2>
      <ContactBlock s={s} />
      {s?.fssai_number && <p>FSSAI Licence No. {s.fssai_number}</p>}
      <p><Link href="/contact">Contact us</Link> for anything at all.</p>
    </LegalPage>
  );
}
