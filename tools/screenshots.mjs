// Takes design screenshots of the running app (CI only, against the mock Supabase).
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.OUT_DIR || "shots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function shoot(ctx, name, path, { full = true, before, wait = 900 } = {}) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("WebSocket") && errors.push(`${name} console: ${m.text().slice(0, 200)}`));
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  if (before) await before(page);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  return page;
}

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const laptop = { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 };

// ---------- customer store (phone) ----------
const store = await browser.newContext(phone);
await shoot(store, "s01-home", "/");
await shoot(store, "s01b-home-top", "/", { full: false });
const cat = await shoot(store, "s02-category", "/c/atta-rice-dal", { full: false });
// add a couple of items from the category page, then look at cart bar
await cat.locator("button:has-text('Add')").first().click().catch(() => {});
await cat.locator("button:has-text('Add')").nth(1).click().catch(() => {});
await cat.waitForTimeout(600);
await cat.screenshot({ path: `${OUT}/s03-category-with-cart.png` });
const firstProduct = await cat.locator("a[href^='/p/']").first().getAttribute("href").catch(() => null);
if (firstProduct) await shoot(store, "s04-product", firstProduct, { full: false });
await shoot(store, "s05-search", "/search?q=tel");
await shoot(store, "s06-cart", "/cart");
await shoot(store, "s07-checkout", "/checkout", {
  before: async (p) => {
    await p.fill("#name", "Priya Deshmukh").catch(() => {});
    await p.fill("#phone", "9876543210").catch(() => {});
    await p.fill("#address", "Flat 203, Sai Residency, Tukum").catch(() => {});
    await p.fill("#pincode", "442001").catch(() => {});
    await p.waitForTimeout(800);
    await p.locator("li button:has-text('Apply')").first().click().catch(() => {});
  },
  wait: 1500,
});
await shoot(store, "s10-terms", "/terms", { full: false });
await shoot(store, "s11-refund", "/refund-policy");
await shoot(store, "s12-footer", "/about");
await shoot(store, "s08-order", "/order?t=00000000-0000-4000-8000-000000000000&new=1", { wait: 1500 });
await shoot(store, "s09-login", "/login", { full: false });

// ---------- owner (phone) ----------
const owner = await browser.newContext(phone);
const login = await owner.newPage();
await login.goto(BASE + "/login", { waitUntil: "networkidle" });
await login.fill("#email", "owner@example.com");
await login.fill("#password", "password123");
await login.click("button[type=submit]");
await login.waitForURL("**/admin", { timeout: 15000 }).catch(() => errors.push("owner login did not reach /admin"));
await login.waitForTimeout(1200);
await login.screenshot({ path: `${OUT}/a01-dashboard.png`, fullPage: true });
await shoot(owner, "a02-live-orders", "/staff", { wait: 1500 });
await shoot(owner, "a03-products", "/admin/products");
const pid = await (await owner.newPage()).evaluate(() => null);
await shoot(owner, "a04-product-new", "/admin/products/new");
const list = await owner.newPage();
await list.goto(BASE + "/admin/products", { waitUntil: "networkidle" });
const edit = await list.locator("a[href^='/admin/products/edit']").first().getAttribute("href").catch(() => null);
if (edit) await shoot(owner, "a05-product-edit", edit, { wait: 1500 });
await shoot(owner, "a06-categories", "/admin/categories");
await shoot(owner, "a07-settings", "/admin/settings");
await shoot(owner, "a08-pincodes", "/admin/pincodes");
await shoot(owner, "a11-banners", "/admin/banners");
await shoot(owner, "a12-coupons", "/admin/coupons");
await shoot(owner, "a13-coupon-new", "/admin/coupons", { before: async (p) => { await p.locator("button:has-text('New')").click().catch(() => {}); await p.fill("#code", "DIWALI10").catch(() => {}); await p.fill("#value", "10").catch(() => {}); await p.fill("#min", "300").catch(() => {}); } });
await shoot(owner, "a09-orders", "/admin/orders?range=all");
const more = await shoot(owner, "a10-more-menu", "/admin", { full: false });
await more.locator("button:has-text('More')").click().catch(() => {});
await more.waitForTimeout(500);
await more.screenshot({ path: `${OUT}/a10-more-menu.png` });

// ---------- owner (laptop) ----------
const desk = await browser.newContext(laptop);
const dl = await desk.newPage();
await dl.goto(BASE + "/login", { waitUntil: "networkidle" });
await dl.fill("#email", "owner@example.com");
await dl.fill("#password", "password123");
await dl.click("button[type=submit]");
await dl.waitForURL("**/admin", { timeout: 15000 }).catch(() => {});
await dl.waitForTimeout(1200);
await dl.screenshot({ path: `${OUT}/d01-dashboard.png`, fullPage: true });
await shoot(desk, "d02-live-orders", "/staff", { wait: 1500 });
await shoot(desk, "d03-store-home", "/", { full: false });

// ---------- counter staff (phone) ----------
const staff = await browser.newContext(phone);
const sl = await staff.newPage();
await sl.goto(BASE + "/login", { waitUntil: "networkidle" });
await sl.fill("#email", "staff@example.com");
await sl.fill("#password", "password123");
await sl.click("button[type=submit]");
await sl.waitForURL("**/staff", { timeout: 15000 }).catch(() => errors.push("staff login did not reach /staff"));
await sl.waitForTimeout(1500);
await sl.screenshot({ path: `${OUT}/c01-counter.png`, fullPage: true });

void pid;
fs.writeFileSync(`${OUT}/errors.txt`, errors.join("\n") || "no errors");
console.log(errors.length ? errors.join("\n") : "no page errors");
await browser.close();
