/** Builds the HTML for order emails. Plain tables + inline styles so it looks right in Gmail. */

export type NotifyOrder = {
  order_no: number;
  public_token: string;
  created_at: string;
  customer_name: string;
  phone: string;
  email: string | null;
  address_line: string;
  landmark: string | null;
  pincode: string;
  instructions: string | null;
  payment_method: "cod" | "upi";
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
  items: { name: string; label: string; qty: number; line_total_paise: number }[];
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const rupees = (p: number) => "₹" + (p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 });

function row(label: string, value: string, strong = false, color = "#1f2630") {
  return `<tr><td style="padding:4px 0;color:#5d6673">${label}</td><td style="padding:4px 0;text-align:right;color:${color};${strong ? "font-weight:800;font-size:18px" : "font-weight:600"}">${value}</td></tr>`;
}

export function orderEmailHtml(o: NotifyOrder, opts: { forOwner: boolean; siteUrl: string }) {
  const no = `#${o.order_no}`;
  const track = `${opts.siteUrl}/order?t=${o.public_token}`;
  const admin = `${opts.siteUrl}/admin/orders`;
  const when = new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  const items = o.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eef0f2">${i.qty} × ${esc(i.name)} <span style="color:#5d6673">(${esc(i.label)})</span></td><td style="padding:6px 0;border-bottom:1px solid #eef0f2;text-align:right;font-weight:600">${rupees(i.line_total_paise)}</td></tr>`,
    )
    .join("");

  const heading = opts.forOwner ? `New order ${no}: ${rupees(o.total_paise)}` : `Thank you, ${esc(o.customer_name.split(" ")[0])}! We've got your order.`;
  const intro = opts.forOwner
    ? `${esc(o.customer_name)} placed an order at ${esc(when)}. Payment: <b>${o.payment_method === "cod" ? "Cash on delivery" : "UPI (check your UPI app)"}</b>.`
    : `Order ${no} placed on ${esc(when)}. The shop will confirm it shortly and it usually reaches you in about ${o.eta_minutes ?? 30} minutes.`;
  const button = opts.forOwner
    ? `<a href="${admin}" style="display:inline-block;background:#e30613;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:12px">Open orders</a>`
    : `<a href="${track}" style="display:inline-block;background:#e30613;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:12px">Track your order</a>`;

  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2630">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:20px 0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#e30613;padding:18px 24px;color:#fff;font-size:20px;font-weight:800">${esc(o.store_name)}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 8px;font-size:22px">${heading}</h1>
<p style="margin:0 0 18px;color:#5d6673;line-height:1.5">${intro}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${items}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;margin-top:10px">
${row("Items", rupees(o.subtotal_paise))}
${row("Delivery", o.delivery_fee_paise ? rupees(o.delivery_fee_paise) : "Free")}
${o.discount_paise > 0 ? row(`Coupon ${esc(o.coupon_code)}`, "−" + rupees(o.discount_paise), false, "#047857") : ""}
${row("Total", rupees(o.total_paise), true)}
</table>
<div style="margin-top:18px;padding:14px;background:#f6f6f4;border-radius:12px;font-size:15px;line-height:1.5">
<b>Deliver to</b><br>${esc(o.customer_name)}, ${esc(o.phone)}<br>${esc(o.address_line)}${o.landmark ? `, near ${esc(o.landmark)}` : ""}, ${esc(o.pincode)}
${o.instructions ? `<br><i>Note: ${esc(o.instructions)}</i>` : ""}
</div>
<p style="margin:22px 0 0">${button}</p>
${opts.forOwner ? "" : `<p style="margin:18px 0 0;color:#5d6673;font-size:13px">Questions? Call ${esc(o.store_phone ?? "")}${o.support_email ? ` or write to ${esc(o.support_email)}` : ""}.</p>`}
</td></tr></table></td></tr></table></body></html>`;
}
