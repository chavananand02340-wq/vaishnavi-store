# Vaishnavi Store

Online ordering for Vaishnavi Store (kirana). Customers order with Cash on Delivery (UPI QR optional); the owner and counter staff manage everything from their phones.

**Stack:** Next.js (App Router, TypeScript, Tailwind) · Supabase (Postgres, Auth, Storage, Realtime) · Netlify

## Status

All planned launch features are built. CI (GitHub Actions) builds the app, type-checks it, runs the delivery-fee unit tests and runs 22 database tests (pricing, tampering, duplicates, stock, staff/owner permissions) on every push.

| Area | What's in it |
|---|---|
| Storefront | Home (delivery promise, PIN checker, categories, popular), category pages, typo-tolerant search incl. Hindi/Marathi keywords, product page with sizes & photos, WhatsApp for bigger quantities |
| Cart & checkout | Browser cart, server re-pricing, free-delivery progress, COD / UPI, remembered address, PIN check, idempotent order placement, price-changed confirmation |
| Order page | Secret link, status steps, ETA, unavailable items struck out, UPI QR with amount + order no., UTR entry, WhatsApp/call store |
| Counter panel `/staff` | Live alarm on new orders (Realtime + polling), screen stays awake, confirm with ETA, item not available, out for delivery, delivered, cash collected, WhatsApp customer |
| Owner admin `/admin` | Dashboard, all orders + detail + history, cancel, UPI verify, products (sizes, offers, stock, photos, duplicate), categories, store & delivery settings, PIN codes |
| Ops | PWA install icons, robots/sitemap, nightly encrypted DB backup workflow, audit log |

**First-time setup: see [SETUP.md](SETUP.md)** (step by step, Hinglish).

### Later (only if needed)
Web push to a locked phone (needs a service worker + VAPID keys), Cloudflare Turnstile if fake orders appear, reorder button, owner screen to add/remove staff logins (needs a server key), Marathi UI.

## Speed

Netlify's free plan runs server code in the US while the database is in Mumbai, so the app avoids server round trips: store pages are cached on the CDN (refreshed every 60 s and immediately via `/api/revalidate` when the owner saves), and cart, checkout, search, login and the whole owner/counter panel talk to Supabase directly from the phone. Row Level Security keeps that safe.

## Design screenshots

`.github/workflows/screenshots.yml` builds the app against `tools/mock-supabase.mjs` and pushes phone/laptop screenshots to the `screenshots` branch.

## Business rules (all editable in **Admin → Store & delivery**)

- Store hours 10:00–22:00 IST + a manual "accepting orders" switch.
- Delivery fee ₹30; free delivery when subtotal ≥ ₹350; expected delivery ~30 min.
- **Fee rule:** base fee = PIN-code special fee if set, else the store fee. Fee is ₹0 when free delivery is on *and* subtotal ≥ threshold; otherwise the base fee applies (including whenever free delivery is turned off).
- **COD never depends on the amount.** It is unavailable only if turned off or the PIN code isn't served.
- Only PIN 442001 at launch.

## How security works

- The browser only ever sends `variant_id + qty`. Prices, delivery fee, totals, stock and PIN eligibility are recomputed inside Postgres (`place_order`). If the total the customer saw differs, the order is **not** created and a new quote is returned (`price_changed`).
- Duplicate taps / retries: each checkout sends an idempotency key, so the same order is never created twice.
- Customers (anon) cannot read or write any order table directly.
- **Staff** see only active orders + today's orders, can move orders forward and mark COD cash collected. They cannot see settings, revenue history, old customers, or cancel orders.
- **Owner** has full access. Every settings, PIN-code and price change is written to `audit_log`.
- No service-role key is used anywhere in the app.

## Setup (one time — short version, full guide in SETUP.md)

### 1. Supabase
1. Create a project at supabase.com (region **Mumbai / ap-south-1**), using the store's Gmail.
2. **SQL Editor** → run the 15 files in `supabase/setup/` in order (01 → 15). Each part is safe to re-run. Never run `supabase/tests/` on Supabase.
3. **Authentication → Sign In / Providers → Email:** turn **off** "Allow new users to sign up".
4. **Authentication → Users → Add user** twice (owner email, counter email), with strong passwords and "Auto confirm".
5. **SQL Editor** → edit and run `supabase/setup_team.sql`.
6. **Project Settings → API:** copy the Project URL and the `anon` / publishable key.

### 2. Netlify
1. Sign up with the store's Gmail → **Add new site → Import from Git → GitHub** → pick this repo.
2. **Site configuration → Environment variables:** add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (once you know the address) `NEXT_PUBLIC_SITE_URL`.
3. Deploy. Use preview deploys for testing; each production deploy uses free-plan credits.

### 3. Local development
```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev                  # http://localhost:3000
npm test                     # delivery-fee rule tests
npm run typecheck
```

## Pages

- Customers: `/`, `/c/[slug]`, `/search`, `/p/[id]`, `/cart`, `/checkout`, `/order?t=<token>`
- `/login` — owner & counter login
- `/staff` — live orders panel (owner and counter)
- `/admin` — owner: dashboard, `orders`, `products`, `categories`, `settings`, `pincodes`

## Backups

The Supabase free plan has no automatic backups. `.github/workflows/backup.yml` dumps the database nightly, encrypts it with a passphrase and keeps it 30 days as a workflow artifact. It does nothing until the two secrets are added (see SETUP.md). Test a restore once before relying on it.

## Tests

- `npm test` — delivery-fee rule unit tests
- `supabase/tests/checkout_test.sql` — run on a throwaway Postgres after `supabase_stubs.sql` + `supabase/setup/*.sql` (CI does this). **Never run on the real project.**
