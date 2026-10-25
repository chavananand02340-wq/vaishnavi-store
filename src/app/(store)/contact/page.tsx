import type { Metadata } from "next";
import { getSettings } from "@/lib/store-data";
import { formatTime } from "@/lib/hours";
import { waLink } from "@/lib/cards";
import { ContactBlock, LegalPage, who } from "@/components/store/legal/LegalPage";

export const metadata: Metadata = { title: "Contact us", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const s = await getSettings();
  const w = who(s);
  const wa = waLink(s?.whatsapp_number, `Hello ${w.name}, I need help with my order.`);
  return (
    <LegalPage title="Contact us" path="/contact">
      <p>The quickest way to reach us is a call or WhatsApp message during shop hours ({formatTime(s?.open_time ?? "10:00")} to {formatTime(s?.close_time ?? "22:00")}, every day).</p>
      <div className="my-5 grid gap-2 sm:grid-cols-2">
        {s?.phone_primary && <a href={`tel:+91${s.phone_primary}`} className="btn-brand">Call {s.phone_primary}</a>}
        {wa && <a href={wa} rel="noopener" className="btn bg-[#25d366] text-[#073b20]">WhatsApp us</a>}
        {s?.maps_url && <a href={s.maps_url} target="_blank" rel="noopener" className="btn-plain">Get directions</a>}
        {s?.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener" className="btn-plain">Instagram</a>}
      </div>
      <h2>Shop address</h2>
      <ContactBlock s={s} />
      <h2>Complaints and grievances</h2>
      <p>
        If something went wrong with an order, tell us with your order number. We reply to every complaint within 48 hours and try to
        resolve it within one month at the latest, as required by the Consumer Protection (E-Commerce) Rules, 2020.
      </p>
      <p>Grievance officer: <b>Sangita Rajendra Shiwarkar (Proprietor)</b>, {w.legal}{w.phone ? `, ${w.phone}` : ""}{w.email ? `, ${w.email}` : ""}.</p>
    </LegalPage>
  );
}
