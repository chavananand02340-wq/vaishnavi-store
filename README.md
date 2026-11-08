# Vaishnavi E-Mart

Online grocery ordering for Vaishnavi Store (kirana, Wardha) at **https://vaishnavistores.shop**. Customers order with cash on delivery or pay online (Razorpay); the owner and counter staff run everything from their phones.

**Stack:** Next.js 15 (App Router, TypeScript, Tailwind 4) · Supabase (Postgres, Auth, Storage, Realtime; Mumbai) · Cloudflare Workers (OpenNext) · Resend (email) · Razorpay (payments)

- **How the code is organised:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (folders, layers, error handling, state, API routes, naming rules)
- **First-time setup (Hinglish, step by step):** [SETUP.md](SETUP.md)

## What it does

| Area | What's in it |
|---|---|
| Storefront | Home with offer banner and sliding banners, categories, product pages with sizes and photos, fast search (English + Hindi/Marathi names, typo tolerant), favourites, "order again" |
| Cart & checkout | Cart saved on the phone, prices re-checked by the database, coupons, free-delivery progress, PIN → city/state auto-fill, "use my current location", COD / online / UPI QR, no double orders |
| Order page | Private tracking link, status steps, ETA, items not available struck out, Razorpay payment and "payment failed" screen |
| Counter `/staff` | Live new-order alarm (Realtime + polling) on every panel page, confirm with ETA, remove unavailable items, out for delivery, delivered, cash collected, WhatsApp the customer, exact map spot |
| Owner `/admin` | Dashboard, all orders + history, products (sizes, offers, stock, photos), categories, banners, coupons, PIN codes, shop settings, system check |
| Emails | Customer "order received", owner "new order", customer "we're packing" |

## Run it locally

```bash
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit tests (src/**/*.test.ts)
npm run typecheck
```

Without a real database, `node tools/mock-supabase.mjs` serves sample data (used by the screenshot workflow).

## Deploy

Every push to `main` builds and deploys to Cloudflare (`.github/workflows/deploy-cloudflare.yml`), copies the runtime secrets from GitHub to Cloudflare, then runs the live checks (`tools/smoke.mjs`). Work happens on the `redesign` branch and is fast-forwarded to `main`.

## Security in short

- The browser only sends `variant_id + qty`. Prices, fees, totals, stock, coupons and PIN eligibility are recomputed in Postgres (`place_order`); a changed total returns a new quote instead of an order.
- Customers can't read order tables; they see one order through its secret token.
- Staff see active and today's orders only; the owner sees everything; changes are written to `audit_log`.
- No service-role key anywhere. Secrets live only in GitHub/Cloudflare secret stores.

## Business rules (editable in Admin → Shop settings)

- Shop hours (IST) plus an "accepting orders" switch.
- Delivery fee, free delivery above a threshold, PIN-code special fees.
- Cash on delivery never depends on the amount.

## Backups

`.github/workflows/backup.yml` dumps the database nightly, encrypted, kept 30 days (needs `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` secrets). Test a restore once before relying on it.
