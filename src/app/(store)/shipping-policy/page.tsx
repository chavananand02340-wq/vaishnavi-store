import type { Metadata } from "next";
import { getSettings } from "@/lib/store-data";
import { formatTime } from "@/lib/hours";
import { formatPaise } from "@/lib/money";
import { LegalPage, who } from "@/components/store/legal/LegalPage";

export const metadata: Metadata = { title: "Delivery policy", alternates: { canonical: "/shipping-policy" } };

export default async function ShippingPage() {
  const s = await getSettings();
  const w = who(s);
  const fee = formatPaise(s?.delivery_fee_paise ?? 3000);
  return (
    <LegalPage title="Delivery policy" path="/shipping-policy">
      <h2>Where we deliver</h2>
      <p>We deliver only to the PIN codes listed by the shop. Enter your PIN code on the home page or at checkout to check. If your area is not listed, call or WhatsApp us and we will tell you if we can still help.</p>
      <h2>Delivery time</h2>
      <p>
        Orders are delivered by the shop&apos;s own staff, usually in about {s?.default_eta_minutes ?? 30} minutes after we confirm the order.
        On festivals, in heavy rain or at busy hours it can take longer; your order page shows the latest time we expect. We take orders
        between {formatTime(s?.open_time ?? "10:00")} and {formatTime(s?.close_time ?? "22:00")}.
      </p>
      <h2>Delivery charges</h2>
      <ul>
        {s?.free_delivery_enabled ? (
          <>
            <li>Orders of {formatPaise(s.free_delivery_threshold_paise)} or more: free delivery.</li>
            <li>Orders below {formatPaise(s.free_delivery_threshold_paise)}: {fee} delivery charge.</li>
          </>
        ) : (
          <li>{fee} delivery charge on every order.</li>
        )}
        {s?.min_order_paise ? <li>Minimum order: {formatPaise(s.min_order_paise)}.</li> : null}
        <li>The exact charge is always shown in your bill before you place the order.</li>
      </ul>
      <h2>At the time of delivery</h2>
      <ul>
        <li>Please keep your phone reachable. Our delivery person may call you to find the address.</li>
        <li>Check your items in front of the delivery person. Tell them straight away if anything is missing, damaged or wrong.</li>
        <li>For cash on delivery, please keep the exact amount ready if you can. You can also pay the delivery person by UPI.</li>
      </ul>
      <h2>Items not available</h2>
      <p>Sometimes an item runs out after you order. We will remove it from your bill (you will see it crossed out on your order page) or call you to suggest a replacement. You never pay for items you did not receive.</p>
      <p>Questions? Call {w.phone ?? "the shop"}.</p>
    </LegalPage>
  );
}
