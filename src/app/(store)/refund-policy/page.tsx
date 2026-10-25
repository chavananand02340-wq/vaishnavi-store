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
        Tell the delivery person at the door, or call or WhatsApp us with a photo on the <b>same day</b> as delivery.
        <b> Expired items are taken back and sorted out the same day.</b>
      </p>
      <p>
        <b>Dairy products</b> (milk, curd, paneer, butter, cheese and similar) are <b>not replaced or returned</b> once delivered, because they
        spoil quickly. Please check them in front of the delivery person; if something is wrong, refuse it at the door and you won&apos;t pay for it.
      </p>
      <p>We cannot take back items that were opened or used, unless they were faulty. Items in good condition that you simply no longer want can be returned only if the shop agrees.</p>

      <h2>How refunds are paid</h2>
      <ul>
        <li><b>Paid by UPI:</b> refunded to the same UPI account, usually within <b>2 to 3 days</b> of approval.</li>
        <li><b>Cash on delivery:</b> refunded by UPI to your number or in cash at the shop, as you prefer, usually within 2 to 3 days.</li>
        <li>Expired items are replaced or refunded the same day.</li>
        <li>Coupon discounts are not paid out as cash. If you return part of an order, the refund is for what you actually paid for those items.</li>
      </ul>
      <p>For any refund question, contact {w.legal}{w.phone ? ` on ${w.phone}` : ""}{w.email ? ` or ${w.email}` : ""}.</p>
    </LegalPage>
  );
}
