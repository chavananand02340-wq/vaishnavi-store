import type { Metadata } from "next";
import { getSettings } from "@/lib/store-data";
import { LegalPage, who } from "@/components/store/legal/LegalPage";

export const metadata: Metadata = { title: "Returns, refunds & cancellation", alternates: { canonical: "/refund-policy" } };

export default async function RefundPage() {
  const s = await getSettings();
  const w = who(s);
  return (
    <LegalPage title="Returns, refunds & cancellation" path="/refund-policy">
      <h2>Cancelling an order</h2>
      <p>You can cancel free of charge until the order leaves the shop. Call or WhatsApp us{w.phone ? ` on ${w.phone}` : ""} with your order number. Once the order is on the way it can no longer be cancelled, but you may refuse items that are damaged or wrong at the door.</p>
      <p>The shop may cancel an order if items are out of stock, the address cannot be reached, or the order looks like a mistake. If you already paid by UPI, we refund the full amount.</p>

      <h2>Returns and replacements</h2>
      <p>Please check your items when they are delivered. We will replace the item or refund you if it is:</p>
      <ul>
        <li>damaged, leaking or with a broken seal,</li>
        <li>past its expiry date, or</li>
        <li>different from what you ordered (wrong product or pack size).</li>
      </ul>
      <p>
        Tell the delivery person at the door, or send a photo on WhatsApp within <b>24 hours</b> of delivery. Fresh items such as fruits,
        vegetables, milk, curd, paneer, bread and eggs must be reported at the time of delivery.
      </p>
      <p>We cannot take back items that were opened or used, unless they were faulty. Items in good condition that you simply no longer want can be returned only if the shop agrees.</p>

      <h2>How refunds are paid</h2>
      <ul>
        <li><b>Paid by UPI:</b> refunded to the same UPI account within 5 to 7 working days of approval.</li>
        <li><b>Cash on delivery:</b> refunded by UPI to your number or in cash at the shop, as you prefer.</li>
        <li>Coupon discounts are not paid out as cash. If you return part of an order, the refund is for what you actually paid for those items.</li>
      </ul>
      <p>For any refund question, contact {w.legal}{w.phone ? ` on ${w.phone}` : ""}{w.email ? ` or ${w.email}` : ""}.</p>
    </LegalPage>
  );
}
