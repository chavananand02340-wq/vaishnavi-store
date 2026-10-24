// A tiny stand-in for Supabase, used ONLY in CI to take design screenshots.
// It answers the REST/RPC/auth calls the app makes with sample kirana data.
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 54321);
const now = Date.now();
const iso = (minsAgo) => new Date(now - minsAgo * 60_000).toISOString();

const settings = {
  id: 1, store_name: "Vaishnavi Store", tagline: "Your neighbourhood kirana", address: "Shop 4, Main Road, near Hanuman Mandir, Chandrapur 442001",
  phone_primary: "9890550785", phone_secondary: "8482891640", whatsapp_number: "9890550785", email: null,
  instagram_url: "https://www.instagram.com/vaish.navi_store/", maps_url: "https://maps.app.goo.gl/CEXEdHUxKe8hmWmk7",
  timezone: "Asia/Kolkata", open_time: "00:00:00", close_time: "23:59:00", accepting_orders: true, closed_message: null, announcement: null,
  delivery_fee_paise: 3000, free_delivery_enabled: true, free_delivery_threshold_paise: 35000, min_order_paise: null, default_eta_minutes: 30,
  cod_enabled: true, upi_enabled: true, upi_id: "vaishnavistore@okaxis", upi_payee_name: "Vaishnavi Store", low_stock_threshold: 5,
};

const cats = [
  ["c1", "Atta, Rice & Dal", "atta-rice-dal"], ["c2", "Oil & Ghee", "oil-ghee"], ["c3", "Masala & Spices", "masala-spices"],
  ["c4", "Snacks & Biscuits", "snacks-biscuits"], ["c5", "Tea, Coffee & Drinks", "tea-coffee-drinks"], ["c6", "Dairy & Breakfast", "dairy-breakfast"],
  ["c7", "Personal Care", "personal-care"], ["c8", "Cleaning & Household", "cleaning-household"],
].map(([id, name, slug], i) => ({ id: uuid(id), name, slug, sort_order: (i + 1) * 10, is_active: true, image_path: null }));

function uuid(seed) {
  const h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0");
  return `${h}-0000-4000-8000-${seed.padEnd(12, "0").replace(/[^0-9a-f]/g, "a").slice(0, 12)}`;
}

const P = [
  ["c1", "Chakki Fresh Whole Wheat Atta", [["5 kg", 265, 290, 12], ["10 kg", 499, 560, 4]], "#d9a441", true],
  ["c1", "Toor Dal", [["500 g", 89, 99, 20], ["1 kg", 172, 190, 8]], "#e8b923", true],
  ["c1", "Basmati Rice", [["1 kg", 135, 160, 15], ["5 kg", 640, 760, 3]], "#efe6cf", false],
  ["c1", "Poha (Thick)", [["500 g", 38, 45, 30]], "#f3e2a9", false],
  ["c1", "Moong Dal", [["500 g", 74, 82, 2]], "#c9d66b", false],
  ["c2", "Refined Sunflower Oil", [["1 L", 155, 175, 18], ["5 L", 745, 820, 0]], "#f5c518", true],
  ["c2", "Pure Cow Ghee", [["500 ml", 335, 360, 6], ["1 L", 650, 699, 3]], "#f2c14e", false],
  ["c2", "Kachi Ghani Mustard Oil", [["1 L", 168, 185, 9]], "#c9a227", false],
  ["c3", "Turmeric Powder", [["100 g", 32, 35, 25], ["200 g", 60, 68, 10]], "#e3a008", false],
  ["c3", "Kashmiri Red Chilli Powder", [["100 g", 58, 65, 14]], "#c0392b", false],
  ["c3", "Garam Masala", [["50 g", 48, 55, 11]], "#7b4b2a", false],
  ["c4", "Glucose Biscuits", [["250 g", 25, 25, 40], ["800 g", 80, 90, 7]], "#f1c40f", true],
  ["c4", "Masala Banana Chips", [["150 g", 45, 50, 0]], "#e67e22", false],
  ["c4", "Salted Peanuts", [["200 g", 40, 45, 22]], "#b9770e", false],
  ["c5", "Assam CTC Tea", [["250 g", 125, 140, 16], ["500 g", 240, 270, 5]], "#7e5109", true],
  ["c5", "Instant Coffee", [["50 g", 160, 175, 4]], "#5d4037", false],
  ["c6", "Toned Milk", [["500 ml", 27, 27, 30]], "#5dade2", true],
  ["c6", "Fresh Paneer", [["200 g", 90, 95, 6]], "#f5f5f0", false],
  ["c7", "Neem Bathing Soap", [["4 x 100 g", 140, 160, 12]], "#58d68d", false],
  ["c8", "Dishwash Bar", [["3 x 200 g", 60, 66, 25]], "#48c9b0", false],
];

const products = P.map(([cat, name, sizes, color, featured], i) => {
  const id = uuid(`p${i}`);
  return {
    id, name, description: i === 0 ? "Stone-ground whole wheat atta for soft rotis. Packed fresh." : null, search_keywords: i === 5 ? "tel, refined" : i === 6 ? "tup" : null,
    category_id: uuid(cat), is_active: true, is_featured: featured, color,
    product_variants: sizes.map(([label, price, mrp, stock], k) => ({
      id: uuid(`v${i}x${k}`), label, price_paise: price * 100, mrp_paise: mrp > price ? mrp * 100 : null,
      sale_price_paise: i === 11 && k === 1 ? 7200 : null, sale_ends_at: null, stock_qty: stock, is_active: true, sort_order: k * 10,
    })),
    product_images: i === 4 ? [] : [{ id: uuid(`i${i}`), storage_path: `products/${id}/main.svg`, sort_order: 0 }],
  };
});
const variants = products.flatMap((p) => p.product_variants.map((v) => ({ ...v, product: p })));

const orderItems = (list) => list.map(([pi, vi, qty, na], k) => {
  const p = products[pi], v = p.product_variants[vi];
  return { id: 100 + pi * 10 + k, product_name: p.name, variant_label: v.label, qty, unit_price_paise: v.price_paise, line_total_paise: v.price_paise * qty, is_unavailable: !!na };
});
function order(no, status, mins, items, extra = {}) {
  const its = orderItems(items);
  const sub = its.filter((i) => !i.is_unavailable).reduce((n, i) => n + i.line_total_paise, 0);
  const fee = sub >= 35000 ? 0 : 3000;
  return {
    id: uuid(`o${no}`), order_no: no, public_token: uuid(`t${no}`), status, customer_name: extra.name ?? "Priya Deshmukh", phone: "9876543210",
    address_line: extra.address ?? "Flat 203, Sai Residency, Tukum", landmark: "near Tukum water tank", pincode: "442001", instructions: extra.note ?? null,
    subtotal_paise: sub, delivery_fee_paise: fee, total_paise: sub + fee, payment_method: extra.pay ?? "cod", payment_status: extra.paid ?? "unpaid",
    upi_utr: extra.utr ?? null, eta_minutes: 30, cancel_reason: extra.reason ?? null, created_at: iso(mins), confirmed_at: status === "new" ? null : iso(mins - 3),
    order_items: its,
  };
}
const orders = [
  order(1012, "new", 2, [[0, 0, 1], [1, 1, 1], [5, 0, 2]], { name: "Priya Deshmukh", note: "Please call before coming, 2nd floor" }),
  order(1011, "new", 6, [[11, 0, 3], [16, 0, 2]], { name: "Rahul Wankhede", address: "Plot 18, Babupeth" }),
  order(1010, "confirmed", 14, [[14, 0, 1], [8, 0, 1], [12, 0, 1, true]], { name: "Sneha Patil", pay: "upi", paid: "awaiting_verification", utr: "412345678901" }),
  order(1009, "out_for_delivery", 28, [[6, 0, 1], [2, 0, 1]], { name: "Amit Gawande" }),
  order(1008, "delivered", 95, [[3, 0, 2], [9, 0, 1]], { name: "Kavita Bhoyar", paid: "paid" }),
  order(1007, "cancelled", 140, [[17, 0, 1]], { name: "Suresh Raut", reason: "Customer asked to cancel" }),
];

// ---------- helpers ----------
function svgFor(name, color) {
  const words = name.split(" ");
  const lines = [];
  for (const w of words) {
    const last = lines.at(-1);
    if (last && (last + " " + w).length <= 12) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  const text = lines.slice(0, 3).map((l, i) => `<text x="200" y="${215 + i * 34}" font-family="Arial" font-size="28" font-weight="700" text-anchor="middle" fill="#fff">${l}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#fff"/><rect x="85" y="60" width="230" height="290" rx="26" fill="${color}"/><rect x="85" y="60" width="230" height="70" rx="26" fill="rgba(0,0,0,.18)"/><circle cx="200" cy="150" r="28" fill="rgba(255,255,255,.85)"/>${text}</svg>`;
}

function b64url(o) {
  return Buffer.from(JSON.stringify(o)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function session(email) {
  const role = email.startsWith("staff") ? "staff" : "owner";
  const sub = role === "owner" ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222";
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const user = { id: sub, aud: "authenticated", role: "authenticated", email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: iso(10000) };
  const access_token = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub, exp, role: "authenticated", email, aud: "authenticated" })}.sig`;
  return { access_token, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: `r-${role}`, user };
}
function roleFrom(req) {
  const auth = req.headers.authorization || "";
  const tok = auth.replace(/^Bearer\s+/i, "");
  try {
    const p = JSON.parse(Buffer.from(tok.split(".")[1], "base64").toString());
    return p.email?.startsWith("staff") ? "staff" : p.email ? "owner" : null;
  } catch {
    return null;
  }
}

function filterRows(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    const [op, ...rest] = v.split(".");
    const val = rest.join(".");
    if (op === "eq") out = out.filter((r) => String(r[k]) === val);
    if (op === "in") {
      const set = new Set(val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/"/g, "")));
      out = out.filter((r) => set.has(String(r[k])));
    }
    if (op === "gte") out = out.filter((r) => String(r[k]) >= val);
    if (op === "lte") out = out.filter((r) => Number(r[k]) <= Number(val));
  }
  return out;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range", ...headers });
  res.end(body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body));
}

function quote(items, pin) {
  const lines = [];
  for (const it of items) {
    const v = variants.find((x) => x.id === it.variant_id);
    if (!v) continue;
    const unit = v.sale_price_paise ?? v.price_paise;
    lines.push({ variant_id: v.id, product_name: v.product.name, variant_label: v.label, unit_price_paise: unit, qty: it.qty, line_total_paise: unit * it.qty });
  }
  if (pin && pin !== "442001") return { ok: false, code: "pincode_unavailable", message: `Sorry, we do not deliver to ${pin} yet.` };
  const sub = lines.reduce((n, l) => n + l.line_total_paise, 0);
  const fee = sub >= 35000 ? 0 : 3000;
  return { ok: true, lines, subtotal_paise: sub, delivery_fee_paise: fee, base_fee_paise: 3000, total_paise: sub + fee, free_delivery_remaining_paise: Math.max(0, 35000 - sub), below_min_order: false, min_order_paise: null, cod_available: true, upi_available: true, store_open: true, eta_minutes: 30 };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  if (req.method === "OPTIONS") return send(res, 204);
  let body = "";
  for await (const chunk of req) body += chunk;
  const json = body ? (() => { try { return JSON.parse(body); } catch { return {}; } })() : {};

  // Images
  if (path.startsWith("/storage/v1/object/public/")) {
    const id = path.split("/")[6];
    const p = products.find((x) => x.id === id);
    res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "max-age=3600" });
    return res.end(svgFor(p?.name ?? "Item", p?.color ?? "#1e7a4c"));
  }

  // Auth
  if (path === "/auth/v1/token") {
    const email = json.email ?? (json.refresh_token?.includes("staff") ? "staff@example.com" : "owner@example.com");
    return send(res, 200, session(email));
  }
  if (path === "/auth/v1/user") {
    const role = roleFrom(req);
    if (!role) return send(res, 401, { message: "no user" });
    return send(res, 200, session(role === "staff" ? "staff@example.com" : "owner@example.com").user);
  }
  if (path === "/auth/v1/logout") return send(res, 204);

  // RPC
  if (path.startsWith("/rest/v1/rpc/")) {
    const fn = path.split("/").pop();
    if (fn === "quote_cart") return send(res, 200, quote(json.p_items ?? [], json.p_pincode));
    if (fn === "place_order") return send(res, 200, { ok: true, order_no: 1013, public_token: orders[0].public_token, duplicate: false, total_paise: quote(json.p_items ?? [], null).total_paise });
    if (fn === "search_products") {
      const q = String(json.p_q ?? "").toLowerCase();
      return send(res, 200, products.filter((p) => `${p.name} ${p.search_keywords ?? ""}`.toLowerCase().includes(q)).map((p) => p.id));
    }
    if (fn === "get_order_by_token") {
      const o = orders.find((x) => x.public_token === json.p_token) ?? orders[2];
      return send(res, 200, { ...o, customer_first_name: o.customer_name.split(" ")[0], items: o.order_items });
    }
    if (fn === "is_owner") return send(res, 200, roleFrom(req) === "owner");
    if (fn === "store_is_open") return send(res, 200, true);
    return send(res, 200, { ok: true });
  }

  // Tables
  if (path.startsWith("/rest/v1/")) {
    const table = path.split("/").pop();
    const role = roleFrom(req);
    const wantsObject = (req.headers.accept || "").includes("vnd.pgrst.object");
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 201, wantsObject ? {} : []);
    const sel = url.searchParams.get("select") || "";
    let rows;
    switch (table) {
      case "store_settings": rows = [settings]; break;
      case "categories": rows = cats; break;
      case "products": rows = products.map(({ color, ...p }) => (sel.includes("product_variants") ? p : { id: p.id, category_id: p.category_id, updated_at: iso(1) })); break;
      case "product_variants": rows = variants.map(({ product, ...v }) => v); break;
      case "delivery_pincodes": rows = [{ pincode: "442001", area_name: "Chandrapur city", is_active: true, fee_override_paise: null }, { pincode: "442401", area_name: "Durgapur", is_active: false, fee_override_paise: 5000 }]; break;
      case "admin_users": rows = role ? [{ role, display_name: role === "owner" ? "Sangita" : "Counter", is_active: true }] : []; break;
      case "orders": rows = role ? orders : []; break;
      case "order_status_history": rows = [
        { id: 1, from_status: null, to_status: "new", note: "Order placed", created_at: iso(14) },
        { id: 2, from_status: "new", to_status: "confirmed", note: null, created_at: iso(11) },
        { id: 3, from_status: "confirmed", to_status: "confirmed", note: "Item unavailable: Masala Banana Chips (150 g) x1", created_at: iso(9) },
      ]; break;
      default: rows = [];
    }
    rows = filterRows(rows, [...url.searchParams.entries()].filter(([k]) => !(table === "products" && k === "is_active")));
    const range = `0-${Math.max(0, rows.length - 1)}/${rows.length}`;
    if (req.method === "HEAD") return send(res, 200, undefined, { "content-range": range });
    if (wantsObject) return rows[0] ? send(res, 200, rows[0], { "content-range": range }) : send(res, 406, { code: "PGRST116", message: "no rows" });
    return send(res, 200, rows, { "content-range": range });
  }

  send(res, 404, { message: "not mocked" });
});

server.listen(PORT, () => console.log(`mock supabase on :${PORT}`));
