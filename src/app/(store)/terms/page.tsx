import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/store-data";
import { ContactBlock, LegalPage, who } from "@/components/store/legal/LegalPage";

export const metadata: Metadata = { title: "Terms & conditions", alternates: { canonical: "/terms" } };

export default async function TermsPage() {
  const s = await getSettings();
  const w = who(s);
  return (
    <LegalPage title="Terms & conditions" path="/terms">
      <p>These terms apply when you browse or order on this website, run by {w.legal}, {w.address}. By placing an order you agree to them.</p>
      <h2>1. Orders</h2>
      <ul>
        <li>Placing an order is a request to buy. The order is accepted when the shop confirms it.</li>
        <li>We may decline or cancel an order, for example if an item is out of stock, the address is outside our delivery area, or the order appears to be a mistake. If you paid by UPI, you get a full refund.</li>
        <li>Products are sold in the pack sizes shown. For bulk or loose quantities, contact us on WhatsApp.</li>
        <li>Orders are for personal and household use. We may limit quantities during sales.</li>
      </ul>
      <h2>2. Prices and payment</h2>
      <ul>
        <li>All prices are in Indian Rupees and include applicable taxes. MRP printed on the pack is the maximum; our price may be lower.</li>
        <li>The price, delivery charge and discount at the moment you place the order are the ones you pay. If a price changes while you are checking out, we show you the new total before you confirm.</li>
        <li>You can pay cash on delivery{s?.upi_enabled ? " or by UPI. UPI payments are confirmed by the shop before delivery" : ""}.</li>
      </ul>
      <h2>3. Coupons and offers</h2>
      <ul>
        <li>One coupon per order. Each coupon has its own minimum order, maximum discount, end date and usage limits, shown at checkout.</li>
        <li>Coupons cannot be exchanged for cash. If an order is cancelled, the coupon may be used again.</li>
        <li>We may change or end an offer at any time, but not for an order already placed. Coupons obtained by misuse may be cancelled.</li>
      </ul>
      <h2>4. Product information</h2>
      <p>We try to show correct photos, sizes and prices. Packaging may differ slightly from the photo. Please read the label for ingredients, allergens and use-by dates before using a product.</p>
      <h2>5. Delivery, returns and refunds</h2>
      <p>See our <Link href="/shipping-policy">Delivery policy</Link> and <Link href="/refund-policy">Returns &amp; refunds policy</Link>.</p>
      <h2>6. Your responsibilities</h2>
      <p>Give a correct name, mobile number and address, and be available to receive the order. Repeated fake or refused cash-on-delivery orders may lead us to stop accepting orders from that number.</p>
      <h2>7. Liability</h2>
      <p>Our responsibility for any order is limited to the amount you paid for it. Nothing in these terms limits your rights under the Consumer Protection Act, 2019.</p>
      <h2>8. Disputes</h2>
      <p>These terms follow the laws of India. Please contact us first so we can try to sort it out; otherwise courts at Wardha, Maharashtra will have jurisdiction.</p>
      <h2>9. Contact and grievances</h2>
      <ContactBlock s={s} />
      <p>We may update these terms. The date at the top shows the latest version.</p>
    </LegalPage>
  );
}
