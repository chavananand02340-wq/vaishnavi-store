# Architecture

How the code is organised, and the rules that keep it that way. Read this before adding a feature.

## The big picture

```
Customer's phone ──► Cloudflare Worker (Next.js via OpenNext) ──► Supabase (Postgres, Mumbai)
        │                     │  cached store pages (KV, 15 min + instant refresh)
        │                     │  /api/* routes (emails, Razorpay, PIN lookup, health)
        └─────────────────────┴──► Supabase directly for cart pricing, checkout, search, panel
```

- **The database is the source of truth.** Prices, stock, delivery fee, coupon rules, order status changes and permissions all live in Postgres functions (`supabase/setup/*.sql`) and Row Level Security. The app never trusts a price from the browser.
- **Phones talk to Supabase directly** (Mumbai is fast from India; the Worker may run elsewhere). RLS decides what each person may read or change.
- **The server only adds what a phone can't do safely:** sending emails, talking to Razorpay with the secret key, PIN code lookups, cache refresh, the owner's system check. It only ever uses the public `anon` key; privileged reads go through database functions that check `NOTIFY_SECRET`. No service-role key exists in this app.

## Folders

```
src/
├─ app/                 Routes only: pages, layouts and API route handlers. Thin.
│  ├─ (store)/          Customer pages (home, category, product, cart, checkout, order, legal…)
│  ├─ admin/  staff/    Owner panel and counter screen
│  ├─ login/
│  └─ api/              HTTP endpoints, each wrapped in route() from server/http.ts
├─ components/          UI only. No database calls.
│  ├─ ui/               Generic pieces used everywhere (Icon, Toast, WhatsAppIcon)
│  ├─ store/            Storefront components
│  └─ admin/            Panel components (AdminUI = the panel's small UI kit)
├─ services/            Business logic + data access (the only code that talks to Supabase)
│  ├─ supabase/         The two clients: browser (with login) and public (cookie-free)
│  ├─ catalog.ts        Server: cached storefront reads (settings, categories, products, banners)
│  ├─ products.ts       Browser: search, products by id
│  ├─ checkout.ts       Browser: quote, place order, save location, coupons, email request
│  ├─ orders.ts         Browser: order tracking by token, UPI reference
│  ├─ payments.ts       Browser: Razorpay popup + our payment API
│  ├─ location.ts       Browser: PIN → city/state, map position → address, PIN served?
│  └─ admin/            Panel: auth, orders, catalog, marketing (banners/coupons), settings, storage
├─ server/              Server-only code (API routes import from here). Never import in "use client" files.
│  ├─ http.ts           route() wrapper, ok()/fail(), readJson(), bearer()
│  ├─ db.ts             anonDb(), userDb(token), requireOwner(req)
│  ├─ payments.ts       Razorpay create / verify / webhook
│  ├─ razorpay.ts       Razorpay REST client + signature helpers
│  ├─ email/            Resend sending + HTML templates
│  ├─ health.ts         Owner system check
│  └─ pincode.ts        India Post PIN lookup
├─ state/               App state that outlives one component
│  ├─ cart.tsx          CartProvider / useCart (saved on the phone)
│  ├─ device-store.ts   Favourites, past orders, PIN, coupon, checkout details (per phone)
│  ├─ team.tsx          TeamProvider / useTeam (who is logged into the panel)
│  └─ alarm.ts          New-order alarm shared by every panel page
├─ hooks/               Reusable React hooks: useAsync, useAction, useQuote, useNewOrders
├─ lib/                 Pure helpers, no React, no database (unit-tested)
│  ├─ catalog.ts        Prices, product cards, image URLs, slugs
│  ├─ money.ts  time.ts validation.ts  errors.ts
│  ├─ product-form.ts  checkout-form.ts  coupon-form.ts  settings-form.ts   (form ⇄ row + checks)
│  ├─ browser-storage.ts  geolocation.ts  image.ts                         (browser APIs, safe wrappers)
├─ config/
│  ├─ env.ts            Public settings (NEXT_PUBLIC_*) — safe in the browser
│  ├─ server-env.ts     Secrets — server only, read lazily
│  └─ site.ts           Fixed facts: names, time zone, storage keys, legal links, limits
└─ types/               Shared shapes: catalog, order, settings
```

### Who may import whom

```
app ──► components ──► hooks / state ──► services ──► lib, config, types
  └──► server (API routes only)  ──────────────────► lib, config, types
```

- `components/` never import `services/supabase/*`; they call a service function.
- `lib/` imports only `lib/`, `config/`, `types/`.
- `server/` is never imported by a `"use client"` file (it reads secrets).
- `services/admin/*` and the browser client are never imported by `server/` or `app/api/`.

## Data flow examples

**Customer places an order**: `checkout/page.tsx` → `lib/checkout-form.ts` (checks) → `services/checkout.placeOrder()` → Postgres `place_order()` (re-prices, checks stock, idempotent) → `setOrderLocation()` (optional) → `requestOrderEmail()` → `/api/order-email` → `server/email/send.ts` → Resend.

**Owner edits a product**: `admin/products/edit/page.tsx` → `lib/product-form.ts` (form → row) → `useAction().run()` → `services/admin/catalog.updateProduct()` → Supabase (RLS: owner only) → toast + `refreshStorefront()` → `/api/revalidate`.

**Online payment**: `components/store/OnlinePayBox` → `services/payments.startPayment()` → `/api/razorpay/order` → `server/payments.createPayment()` (amount from the database) → Razorpay popup → `confirmPayment()` → `/api/razorpay/verify` → `mark_online_paid()`; Razorpay's webhook does the same if the customer closes the page.

## Error handling

| Where | How |
|---|---|
| `lib/errors.ts` | `AppError(code, message)` — `message` is always safe to show; technical detail goes in `cause`. `unwrap(res, friendly)` turns a Supabase result into data or an AppError. |
| Services (read) | Panel reads throw AppError; screens show it with `useAsync` → `ErrorBox` / `ErrorState` + "Try again". Storefront server reads log and return empty data so pages still render. |
| Services (actions) | Panel actions throw AppError; screens run them through `useAction()` (busy flag, success toast, error toast, store refresh). Order actions and checkout return `{ ok, message }` and never throw. |
| API routes | Wrapped in `route()`: AppError → its HTTP status + `{ ok: false, code, message }`; anything unexpected → 500 with a generic message, details only in the Worker log. |
| Pages | `app/error.tsx` catches render errors for the whole app; the panel and storefront show inline errors with retry. |
| Best-effort extras | Emails, map location, store refresh, photo clean-up: failures are logged and never block the main action. |

## State

- **Server data** is loaded per screen with `useAsync(serviceFn, deps)` (loading / error / reload, stale answers ignored).
- **Cart** is a React context (`state/cart.tsx`) saved to the phone; prices are re-checked by the database (`hooks/useQuote.ts`).
- **Per-phone memory** (`state/device-store.ts`) uses `lib/browser-storage.ts`, which never throws and notifies other components/tabs of changes.
- **Panel login** is a context (`state/team.tsx`); the **alarm** is a tiny module-level store (`state/alarm.ts`) so it keeps ringing across panel pages.

## API routes

| Route | Who | What |
|---|---|---|
| `GET /api/pincode?pin=` | anyone | PIN → `{ city, state, areas }` (cached 7 days) |
| `POST /api/order-email` `{ token, event }` | anyone with the order token | Sends order emails once per event |
| `POST /api/razorpay/order` `{ token }` | customer | Razorpay checkout options; amount from the database |
| `POST /api/razorpay/verify` | customer | Checks the signature, marks paid |
| `POST /api/razorpay/webhook` | Razorpay | Signature-checked; marks paid |
| `POST /api/revalidate` | owner (Bearer token) | Refresh cached store pages now |
| `GET /api/health[?email=1]` | owner (Bearer token) | System check / test email |

To add one: create `src/app/api/<name>/route.ts`, export `const POST = route("<name>", async (req) => …)`, validate input with `lib/validation.ts`, put the logic in `src/server/<name>.ts`, throw `AppError` for expected problems, and add a check to `tools/smoke.mjs`.

## Naming conventions

| Thing | Style | Example |
|---|---|---|
| React component file | PascalCase, one main component | `OrderCard.tsx`, `OnlinePayBox.tsx` |
| Hook | `useX.ts` in `hooks/` | `useAction.ts` |
| Other modules | kebab-case | `product-form.ts`, `server-env.ts` |
| Functions / variables | camelCase, verbs for actions | `placeOrder`, `listCoupons`, `isPincode` |
| Constants | UPPER_SNAKE | `STORAGE_KEYS`, `MAX_QTY` |
| Types | PascalCase | `OrderRow`, `CardProduct` |
| Database rows | snake_case, as in Postgres | `total_paise`, `is_active` |
| UI view models | camelCase | `CardProduct.nameLocal` |
| Money | integer paise everywhere; `formatPaise()` only for display | `price_paise: 34950` |

## Environment

| Variable | Where | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | GitHub secrets (build) + Cloudflare | Everything |
| `NEXT_PUBLIC_SITE_URL` | Deploy workflow | Sitemap, links in emails |
| `NOTIFY_SECRET` | GitHub secret → Cloudflare secret | Emails, payments (must match the database) |
| `RESEND_API_KEY`, `EMAIL_FROM` | GitHub secret → Cloudflare secret | Order emails |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | GitHub secret → Cloudflare secret | Online payment |

Code reads these only through `config/env.ts` (public) and `config/server-env.ts` (secrets). Local development: copy `.env.example` to `.env.local`. Never commit real values.

## Checks

- `npm test` — unit tests for `lib/` (prices, forms, time, validation, money).
- `npm run typecheck` and `npm run build` — run in CI on every push.
- `supabase/tests/checkout_test.sql` — database tests (CI runs every setup part twice, then the tests).
- `tools/smoke.mjs` — 50 live checks against the real site after every deploy and daily.
- `tools/screenshots.mjs` — phone/laptop screenshots against a mock database.
