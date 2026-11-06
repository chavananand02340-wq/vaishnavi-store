// Live checks of the real website (run by GitHub Actions after each deploy).
// Prints PASS/FAIL per check and exits 1 if anything important fails.
const B = process.env.SITE || "https://vaishnavistores.shop";
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRETS = ["RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "RESEND_API_KEY", "NOTIFY_SECRET"]
  .map((k) => [k, (process.env[k] || "").trim()])
  .filter(([, v]) => v.length >= 8);

const results = [];
const check = async (name, fn) => {
  try {
    const r = await fn();
    results.push([r === true || r?.ok ? "PASS" : "FAIL", name, r?.note ?? ""]);
  } catch (e) {
    results.push(["FAIL", name, String(e?.message || e).slice(0, 160)]);
  }
};
const get = (p, init) => fetch(p.startsWith("http") ? p : B + p, { redirect: "manual", ...init });
const ok = (cond, note) => ({ ok: Boolean(cond), note });

// ---------- Pages ----------
const html = {};
for (const p of ["/", "/about", "/terms", "/privacy", "/refund-policy", "/shipping-policy", "/contact", "/cart", "/checkout", "/categories", "/orders", "/favourites", "/search", "/search?q=rice", "/login", "/admin", "/staff", "/sitemap.xml", "/robots.txt"]) {
  await check(`page ${p}`, async () => {
    const t = Date.now();
    const r = await get(p);
    const body = await r.text();
    html[p] = body;
    const bad = /Application error|Internal Server Error|exceeded resources|Error 1102/i.test(body);
    return ok(r.status === 200 && !bad, `${r.status}, ${Date.now() - t} ms${bad ? ", error text in page" : ""}`);
  });
}
await check("home shows products", async () => ok(/Shop by category/.test(html["/"] || ""), "Shop by category present"));
const sm = html["/sitemap.xml"] || "";
const cat = sm.match(/<loc>(https?:\/\/[^<]+\/c\/[^<]+)<\/loc>/)?.[1];
const prod = sm.match(/<loc>(https?:\/\/[^<]+\/p\/[^<]+)<\/loc>/)?.[1];
if (cat) await check("a category page", async () => { const r = await get(cat); return ok(r.status === 200, `${r.status} ${cat.replace(B, "")}`); });
if (prod) await check("a product page", async () => { const r = await get(prod); return ok(r.status === 200, `${r.status} ${prod.replace(B, "")}`); });

// ---------- Domain, HTTPS, headers ----------
await check("http → https", async () => { const r = await get(B.replace("https:", "http:") + "/"); return ok([301, 302, 307, 308].includes(r.status) && (r.headers.get("location") || "").startsWith("https://"), `${r.status} → ${r.headers.get("location")}`); });
await check("www → main domain (keeps link)", async () => { const r = await get(B.replace("https://", "https://www.") + "/order?t=x"); return ok(r.status === 301 && r.headers.get("location") === B + "/order?t=x", `${r.status} → ${r.headers.get("location")}`); });
await check("security headers", async () => {
  const r = await get("/");
  const h = (k) => r.headers.get(k) || "";
  return ok(h("x-frame-options") === "DENY" && h("x-content-type-options") === "nosniff" && h("referrer-policy"), `frame=${h("x-frame-options")} nosniff=${h("x-content-type-options")} referrer=${h("referrer-policy")}`);
});
await check("PIN lookup (442001 → Wardha)", async () => { const r = await get("/api/pincode?pin=442001"); const j = await r.json().catch(() => ({})); return ok(j.ok && /wardha/i.test(j.city || "") && /maharashtra/i.test(j.state || ""), `${r.status} ${j.city || "-"}, ${j.state || "-"}`); });
await check("served by Cloudflare", async () => { const r = await get("/"); return ok((r.headers.get("server") || "").includes("cloudflare"), r.headers.get("server")); });

// ---------- APIs refuse bad requests ----------
const post = (p, body, headers = {}) => get(p, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
await check("system check needs owner login", async () => { const r = await get("/api/health"); return ok(r.status === 401, `${r.status}`); });
await check("test email needs owner login", async () => { const r = await get("/api/health?email=1"); return ok(r.status === 401, `${r.status}`); });
await check("page refresh needs owner login", async () => { const r = await post("/api/revalidate", {}); return ok(r.status === 401 || r.status === 403, `${r.status}`); });
await check("webhook rejects fake signature", async () => { const r = await post("/api/razorpay/webhook", { event: "payment.captured", payload: {} }, { "x-razorpay-signature": "fake" }); return ok(r.status === 400, `${r.status}`); });
await check("payment verify rejects fake signature", async () => { const r = await post("/api/razorpay/verify", { razorpay_order_id: "order_x", razorpay_payment_id: "pay_x", razorpay_signature: "fake" }); return ok(r.status === 400, `${r.status}`); });
await check("start payment rejects bad token", async () => { const r = await post("/api/razorpay/order", { token: "nope" }); return ok(r.status === 400, `${r.status}`); });
await check("start payment: unknown order", async () => { const r = await post("/api/razorpay/order", { token: "00000000-0000-4000-8000-000000000000" }); return ok(r.status === 404, `${r.status}`); });
await check("order email: unknown order does nothing", async () => { const r = await post("/api/order-email", { token: "00000000-0000-4000-8000-000000000000" }); const j = await r.json(); return ok(j.ok === false, JSON.stringify(j)); });

// ---------- Database rules (as a stranger with the public key) ----------
if (SB && ANON) {
  const rest = (path, init = {}) => fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "content-type": "application/json", ...(init.headers || {}) } });
  await check("db: products are readable", async () => { const r = await rest("products?select=id&limit=1"); return ok(r.status === 200, `${r.status}`); });
  for (const t of ["orders", "order_items", "admin_users", "audit_log", "order_status_history"]) {
    await check(`db: strangers can't read ${t}`, async () => { const r = await rest(`${t}?select=*&limit=1`); const j = await r.json().catch(() => null); return ok(r.status >= 400 || (Array.isArray(j) && j.length === 0), `${r.status} ${Array.isArray(j) ? j.length + " rows" : ""}`); });
  }
  await check("db: strangers can't add products", async () => { const r = await rest("products", { method: "POST", body: JSON.stringify({ name: "hack" }) }); return ok(r.status >= 400, `${r.status}`); });
  await check("db: strangers can't change prices", async () => { const r = await rest("product_variants?id=neq.00000000-0000-0000-0000-000000000000", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ price_paise: 1 }) }); const j = await r.json().catch(() => null); return ok(r.status >= 400 || (Array.isArray(j) && j.length === 0), `${r.status}`); });
  await check("db: strangers can't change settings", async () => { const r = await rest("store_settings?id=eq.1", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ cod_enabled: false }) }); const j = await r.json().catch(() => null); return ok(r.status >= 400 || (Array.isArray(j) && j.length === 0), `${r.status}`); });
  await check("db: strangers can't create coupons", async () => { const r = await rest("coupons", { method: "POST", body: JSON.stringify({ code: "HACK99", kind: "percent", value: 90 }) }); return ok(r.status >= 400, `${r.status}`); });
  await check("db: hidden coupons stay hidden", async () => { const r = await rest("coupons?select=code,show_in_checkout,is_active"); const j = await r.json(); return ok(Array.isArray(j) && j.every((c) => c.show_in_checkout && c.is_active), `${j.length} visible`); });
  await check("db: secrets table not reachable", async () => { const r = await rest("secrets?select=*"); return ok(r.status >= 400, `${r.status}`); });
  await check("db: payment marking needs secret", async () => { const r = await rest("rpc/mark_online_paid", { method: "POST", body: JSON.stringify({ p_secret: "wrong", p_rp_order: "x", p_rp_payment: "y", p_amount_paise: 1 }) }); const j = await r.json(); return ok(j?.ok === false, JSON.stringify(j)); });
  await check("db: price check (quote) works", async () => { const r = await rest("rpc/quote_cart", { method: "POST", body: JSON.stringify({ p_items: [] }) }); return ok(r.status === 200, `${r.status}`); });
}

// ---------- No secret inside the website's code ----------
if (SECRETS.length) {
  await check("no secret keys in browser code", async () => {
    const pages = ["/", "/checkout", "/admin", "/login", "/order?t=00000000-0000-4000-8000-000000000000"];
    const srcs = new Set();
    for (const p of pages) {
      const body = html[p] ?? (await (await get(p)).text());
      for (const m of body.matchAll(/\/_next\/static\/[^"'\s]+\.js/g)) srcs.add(m[0]);
    }
    let leaked = [];
    for (const s of srcs) {
      const js = await (await get(s)).text();
      for (const [k, v] of SECRETS) if (js.includes(v)) leaked.push(`${k} in ${s}`);
    }
    for (const p of Object.keys(html)) for (const [k, v] of SECRETS) if (html[p].includes(v)) leaked.push(`${k} in page ${p}`);
    return ok(leaked.length === 0, leaked.length ? leaked.join("; ") : `${srcs.size} scripts scanned`);
  });
}

const fails = results.filter((r) => r[0] === "FAIL");
for (const [s, n, note] of results) console.log(`${s === "PASS" ? "✅" : "❌"} ${n}${note ? "  (" + note + ")" : ""}`);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const fs = await import("node:fs");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Live site check\n\n${results.map(([s, n, note]) => `- ${s === "PASS" ? "✅" : "❌"} **${n}** ${note}`).join("\n")}\n\n**${results.length - fails.length}/${results.length} passed**\n`);
}
process.exit(fails.length ? 1 : 0);
