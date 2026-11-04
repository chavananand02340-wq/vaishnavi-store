/**
 * HTML for the three order emails. Tables + inline styles so they look right in Gmail/Outlook.
 *  - "received": customer, right after ordering
 *  - "owner":    shop owner, right after ordering
 *  - "packing":  customer, when the shop accepts the order
 */

export type EmailKind = "received" | "owner" | "packing";

export type NotifyOrder = {
  order_no: number;
  public_token: string;
  created_at: string;
  confirmed_at?: string | null;
  customer_name: string;
  phone: string;
  email: string | null;
  address_line: string;
  landmark: string | null;
  pincode: string;
  instructions: string | null;
  payment_method: "cod" | "upi" | "online";
  payment_status?: "unpaid" | "awaiting_verification" | "paid";
  subtotal_paise: number;
  delivery_fee_paise: number;
  discount_paise: number;
  coupon_code: string | null;
  total_paise: number;
  eta_minutes: number | null;
  store_name: string;
  notify_email: string | null;
  support_email: string | null;
  store_phone: string | null;
  store_whatsapp?: string | null;
  store_address?: string | null;
  items: { name: string; label: string; qty: number; unit_price_paise?: number; line_total_paise: number; unavailable?: boolean }[];
};

const RED = "#e30613";
const INK = "#1f2630";
const MUTED = "#5d6673";
const LINE = "#eceef1";
const GREEN = "#047857";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const rupees = (p: number) =>
  "₹" + (p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 });

const ist = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...opts });

function button(href: string, text: string, bg = RED, color = "#ffffff") {
  return `<a href="${href}" style="display:inline-block;background:${bg};color:${color};text-decoration:none;font-weight:800;font-size:15px;padding:13px 22px;border-radius:12px;margin:4px 6px 4px 0">${text}</a>`;
}

function steps(active: 1 | 2) {
  const s = (n: number, label: string) => {
    const on = n <= active;
    return `<td align="center" style="width:25%;padding:0 2px">
      <div style="width:28px;height:28px;line-height:28px;border-radius:14px;margin:0 auto;font-size:13px;font-weight:800;${on ? `background:${RED};color:#fff` : `background:#f1f2f4;color:${MUTED}`}">${on ? "✓" : n}</div>
      <div style="font-size:12px;margin-top:6px;color:${on ? INK : MUTED};font-weight:${on ? 700 : 400}">${label}</div></td>`;
  };
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px">
    <tr>${s(1, "Order received")}${s(2, "Packing")}${s(3, "On the way")}${s(4, "Delivered")}</tr></table>`;
}

function itemsTable(o: NotifyOrder, owner = false) {
  const rows = o.items
    .map((i) => {
      const off = i.unavailable;
      const unit = i.unit_price_paise ?? Math.round(i.line_total_paise / Math.max(1, i.qty));
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};vertical-align:top;${off ? `color:${MUTED};text-decoration:line-through` : ""}">
          <div style="font-weight:700;font-size:15px">${esc(i.name)}</div>
          <div style="font-size:13px;color:${MUTED}">${esc(i.label)} · ${rupees(unit)} each${off ? " · not available, removed" : ""}</div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid ${LINE};text-align:center;vertical-align:top;font-size:15px;white-space:nowrap">× ${i.qty}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};text-align:right;vertical-align:top;font-weight:700;font-size:15px;white-space:nowrap;${off ? `color:${MUTED};text-decoration:line-through` : ""}">${rupees(i.line_total_paise)}</td>
      </tr>`;
    })
    .join("");
  const count = o.items.filter((i) => !i.unavailable).reduce((n, i) => n + i.qty, 0);
  const line = (label: string, value: string, style = "") =>
    `<tr><td style="padding:5px 0;color:${MUTED};font-size:15px;${style}">${label}</td><td style="padding:5px 0;text-align:right;font-size:15px;font-weight:600;${style}">${value}</td></tr>`;
  return `
  <h2 style="margin:22px 0 4px;font-size:17px;color:${INK}">${owner ? "Items ordered" : "Your items"} (${count})</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><th align="left" style="font-size:12px;color:${MUTED};font-weight:600;padding:6px 0;border-bottom:2px solid ${LINE}">Item</th>
        <th style="font-size:12px;color:${MUTED};font-weight:600;padding:6px 8px;border-bottom:2px solid ${LINE}">Qty</th>
        <th align="right" style="font-size:12px;color:${MUTED};font-weight:600;padding:6px 0;border-bottom:2px solid ${LINE}">Amount</th></tr>
    ${rows}
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">
    ${line("Items total", rupees(o.subtotal_paise))}
    ${line("Delivery", o.delivery_fee_paise ? rupees(o.delivery_fee_paise) : `<span style="color:${GREEN}">FREE</span>`)}
    ${o.discount_paise > 0 ? line(`Coupon ${esc(o.coupon_code)}`, "−" + rupees(o.discount_paise), `color:${GREEN}`) : ""}
    <tr><td colspan="2" style="border-top:2px dashed ${LINE};padding-top:8px"></td></tr>
    <tr><td style="font-size:18px;font-weight:800;color:${INK}">${o.payment_status === "paid" ? "Paid" : owner ? (o.payment_method === "cod" ? "Collect cash" : "Total") : "To pay"}</td>
        <td style="text-align:right;font-size:22px;font-weight:800;color:${INK}">${rupees(o.total_paise)}</td></tr>
  </table>
  ${o.discount_paise > 0 && !owner ? `<p style="margin:10px 0 0;padding:10px 12px;background:#ecfdf5;border-radius:10px;color:${GREEN};font-weight:700;font-size:14px">🎉 You saved ${rupees(o.discount_paise)} with coupon ${esc(o.coupon_code)}</p>` : ""}`;
}

function box(title: string, body: string) {
  return `<div style="margin-top:16px;padding:14px 16px;background:#f6f6f4;border-radius:14px;font-size:15px;line-height:1.55;color:${INK}">
    <div style="font-size:12px;font-weight:800;letter-spacing:.06em;color:${MUTED};text-transform:uppercase;margin-bottom:4px">${title}</div>${body}</div>`;
}

const payText = (o: NotifyOrder) =>
  o.payment_method === "online"
    ? o.payment_status === "paid"
      ? `<b>Paid online</b> ✓`
      : `<b>Online payment</b><br>Not paid yet. Tap "Track your order" to pay.`
    : o.payment_method === "cod"
    ? `<b>Cash on delivery</b><br>Please keep ${rupees(o.total_paise)} ready. You can also pay the delivery person by UPI.`
    : o.payment_status === "paid"
      ? `<b>UPI, paid</b> ✓`
      : `<b>UPI</b><br>The shop will confirm your payment shortly.`;

export function subjectFor(kind: EmailKind, o: NotifyOrder) {
  if (kind === "owner") return `🛒 New order #${o.order_no}: ${rupees(o.total_paise)} (${o.payment_method === "cod" ? "Cash" : o.payment_method === "online" ? "Online" : "UPI"}) from ${o.customer_name}`;
  if (kind === "packing") return `📦 We're packing your order #${o.order_no}`;
  return `✅ Order received #${o.order_no}: ${rupees(o.total_paise)}`;
}

export function orderEmailHtml(kind: EmailKind, o: NotifyOrder, siteUrl: string) {
  const no = `#${o.order_no}`;
  const first = esc(o.customer_name.split(" ")[0]);
  const track = `${siteUrl}/order?t=${o.public_token}`;
  const when = ist(o.created_at, { dateStyle: "medium", timeStyle: "short" });
  const eta = o.eta_minutes ?? 30;
  const wa = o.store_whatsapp ? `https://wa.me/91${o.store_whatsapp}?text=${encodeURIComponent(`Hello, about my order ${no}`)}` : null;
  const address = `${esc(o.customer_name)} · ${esc(o.phone)}<br>${esc(o.address_line)}${o.landmark ? `, ${/^near\b/i.test(o.landmark.trim()) ? "" : "near "}${esc(o.landmark.trim())}` : ""}, ${esc(o.pincode)}${o.instructions ? `<br><i style="color:${MUTED}">Note: ${esc(o.instructions)}</i>` : ""}`;

  let hero = "";
  let body = "";

  if (kind === "received") {
    hero = `<div style="font-size:40px;line-height:1">🛍️</div>
      <h1 style="margin:10px 0 6px;font-size:24px;color:${INK}">Thank you, ${first}! We've received your order.</h1>
      <p style="margin:0;color:${MUTED};font-size:15px;line-height:1.5">Order <b style="color:${INK}">${no}</b> · ${esc(when)}<br>The shop will check your order and start packing in a few minutes. It usually reaches you in about <b style="color:${INK}">${eta} minutes</b>.</p>`;
    body = `${steps(1)}${itemsTable(o)}${box("Delivering to", address)}${box("Payment", payText(o))}
      <p style="margin:22px 0 0">${button(track, "Track your order")}${wa ? button(wa, "WhatsApp the shop", "#25d366", "#073b20") : ""}</p>`;
  } else if (kind === "packing") {
    const ready = o.confirmed_at ? ist(new Date(new Date(o.confirmed_at).getTime() + eta * 60000).toISOString(), { timeStyle: "short" }) : null;
    hero = `<div style="font-size:40px;line-height:1">📦</div>
      <h1 style="margin:10px 0 6px;font-size:24px;color:${INK}">Good news, ${first}! We're packing your order.</h1>
      <p style="margin:0;color:${MUTED};font-size:15px;line-height:1.5">The shop has accepted order <b style="color:${INK}">${no}</b>.</p>
      <div style="margin:16px 0 0;padding:14px 16px;background:#fff7d6;border-radius:14px;color:#7a5300;font-size:16px;font-weight:800">🛵 Arriving in about ${eta} minutes${ready ? `, by ${esc(ready)}` : ""}</div>`;
    body = `${steps(2)}${itemsTable(o)}${o.items.some((i) => i.unavailable) ? `<p style="margin:10px 0 0;font-size:14px;color:#7a5300">Some items weren't available today, so they are removed from your bill.</p>` : ""}
      ${box("Delivering to", address)}${box("Payment", payText(o))}
      <p style="margin:22px 0 0">${button(track, "Track your order")}${o.store_phone ? button(`tel:+91${o.store_phone}`, "Call the shop", "#f1f2f4", INK) : ""}</p>`;
  } else {
    const callCust = `tel:+91${o.phone}`;
    const waCust = `https://wa.me/91${o.phone}?text=${encodeURIComponent(`Hello ${o.customer_name}, ${o.store_name} here about your order ${no}.`)}`;
    const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address_line} ${o.landmark ?? ""} ${o.pincode}`)}`;
    hero = `<div style="font-size:40px;line-height:1">🔔</div>
      <h1 style="margin:10px 0 6px;font-size:24px;color:${INK}">New order ${no}: ${rupees(o.total_paise)}</h1>
      <p style="margin:0;color:${MUTED};font-size:15px;line-height:1.5">${esc(o.customer_name)} ordered at ${esc(when)}.<br>Payment: <b style="color:${INK}">${o.payment_method === "cod" ? "Cash on delivery" : o.payment_method === "online" ? (o.payment_status === "paid" ? "Paid online ✓" : "Online (not paid yet)") : "UPI (check your UPI app)"}</b></p>
      <p style="margin:16px 0 0">${button(`${siteUrl}/staff`, "Open live orders")}</p>`;
    body = `${itemsTable(o, true)}${box("Customer", address)}
      <p style="margin:16px 0 0">${button(callCust, "📞 Call customer", "#f1f2f4", INK)}${button(waCust, "WhatsApp customer", "#25d366", "#073b20")}${button(map, "📍 Map", "#f1f2f4", INK)}</p>
      ${o.email ? `<p style="margin:10px 0 0;font-size:13px;color:${MUTED}">Customer email: ${esc(o.email)} (they got a receipt)</p>` : ""}`;
  }

  const footer = `${esc(o.store_name)}${o.store_address ? ` · ${esc(o.store_address)}` : ""}<br>
    ${o.store_phone ? `Call ${esc(o.store_phone)}` : ""}${o.support_email ? ` · ${esc(o.support_email)}` : ""}<br>
    <a href="${siteUrl}" style="color:${RED};font-weight:700;text-decoration:none">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;background:#f6f6f4;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:18px 10px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
  <tr><td style="background:#ffffff;border-radius:18px 18px 0 0;padding:18px 24px;border-bottom:4px solid ${RED}">
    <img src="${siteUrl}/brand/logo-compact.png" alt="${esc(o.store_name)}" width="150" style="display:block;height:auto;border:0">
  </td></tr>
  <tr><td style="background:#ffffff;padding:24px;border-radius:0 0 18px 18px">${hero}${body}</td></tr>
  <tr><td style="padding:18px 10px;text-align:center;font-size:12.5px;line-height:1.6;color:${MUTED}">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}
