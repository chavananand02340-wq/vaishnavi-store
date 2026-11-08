import type { Metadata } from "next";
import { getSettings } from "@/services/catalog";
import { ContactBlock, LegalPage, who } from "@/components/store/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default async function PrivacyPage() {
  const s = await getSettings();
  const w = who(s);
  return (
    <LegalPage title="Privacy policy" path="/privacy">
      <p>This policy explains what {w.legal} (&quot;we&quot;) collects when you order on this website and how we use it. We follow the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Order details:</b> your name, mobile number, delivery address, landmark, PIN code, any note you add, and email if you give one.</li>
        <li><b>Your location, only if you tap "Use my current location":</b> the map position of your phone at checkout, so our delivery person can find you. It is saved with that one order and shown only to the shop team. Your address and PIN code are looked up through free map and India Post services to fill city and state.</li>
        <li><b>What you ordered</b> and how you paid. For UPI we see the payment in our own UPI app; we never see your UPI PIN, bank or card details.</li>
        <li><b>On your phone only:</b> your cart, saved address and PIN code are kept in your browser so you don&apos;t have to type them again. You can clear them by clearing your browser data.</li>
      </ul>
      <p>We do not ask you to create an account or password, and we do not use advertising trackers.</p>
      <h2>How we use it</h2>
      <ul>
        <li>To pack and deliver your order and to call or WhatsApp you about it.</li>
        <li>To send an order receipt to your email, if you gave one.</li>
        <li>To keep records of sales, as the law requires, and to handle complaints and refunds.</li>
      </ul>
      <p>We do not sell or rent your details to anyone and we do not send marketing messages without asking you first.</p>
      <h2>Who else handles it</h2>
      <p>Your data is stored with Supabase (database servers in Mumbai, India). The website is hosted by Cloudflare, online payments are handled by Razorpay, and order emails are sent through Resend. These services process data only to run this website for us.</p>
      <h2>How long we keep it</h2>
      <p>We keep order records for up to 8 years for tax and accounting purposes, and then delete them.</p>
      <h2>Your rights</h2>
      <p>You can ask us to see, correct or delete your details, or to stop contacting you, by calling or writing to us. We may need to keep some order records where the law requires it.</p>
      <h2>Contact</h2>
      <ContactBlock s={s} />
    </LegalPage>
  );
}
