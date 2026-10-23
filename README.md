# Vaishnavi Store

Online ordering for Vaishnavi Store (kirana). Customers order with Cash on Delivery (UPI QR optional); the owner and counter staff manage everything from their phones.

**Stack:** Next.js (App Router, TypeScript, Tailwind) · Supabase (Postgres, Auth, Storage, Realtime) · Netlify

## Status

| Phase | What | State |
|---|---|---|
| 1 | Database, security rules, owner/staff login, store & delivery settings, PIN codes, basic orders panel | ✅ in this repo |
| 2 | Product & category admin (add one by one, photos, stock) | next |
| 3 | Storefront: home, categories, search, product pages | |
| 4 | Cart, checkout, confirmation page | (database side already done: `quote_cart`, `place_order`) |
| 5 | Live new-order sound, ETA per order, cancel/unavailable items | |
| 6 | Testing on phones, backups, launch | |

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

## Setup (one time)

### 1. Supabase
1. Create a project at supabase.com (region **Mumbai / ap-south-1**), using the store's Gmail.
2. **SQL Editor** → run `supabase/migrations/20261023000001_init.sql`, then `20261023000002_storage_realtime.sql`.
3. **Authentication → Sign In / Providers → Email:** turn **off** "Allow new users to sign up".
4. **Authentication → Users → Add user** twice (owner email, counter email), with strong passwords and "Auto confirm".
5. **SQL Editor** → edit and run `supabase/setup_team.sql`.
6. **Project Settings → API:** copy the Project URL and the `anon` / publishable key.

### 2. Netlify
1. Sign up with the store's Gmail → **Add new site → Import from Git → GitHub** → pick this repo.
2. **Site configuration → Environment variables:** add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
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

- `/` — temporary landing page (storefront comes in Phase 3)
- `/login` — owner & counter login
- `/admin` — owner dashboard, `/admin/settings`, `/admin/pincodes`
- `/staff` — orders panel (owner and counter)

## Backups

The Supabase free plan has no automatic backups. Before launch we'll add a nightly `pg_dump` job (GitHub Actions) to private storage, and test a restore.
