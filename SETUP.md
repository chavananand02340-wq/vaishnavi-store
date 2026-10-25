# Setup guide — step by step (Hinglish)

Total time: ~45 minutes. Kuch bhi password ya secret key chat mein paste mat karna.

---

## Step 1 — Supabase project (10 min)

1. Store ki Gmail se https://supabase.com par sign up → **New project**
   - Name: `vaishnavi-store`
   - Database password: strong password banao aur **safe jagah likh lo** (backup ke liye chahiye)
   - Region: **South Asia (Mumbai)**
2. Project ready hone tak 2 minute wait karo.

## Step 2 — SQL chalana (15 chhote parts)

Supabase → left menu **SQL Editor** → **New query**. Repo ke `supabase/setup/` folder mein 15 files hain (`01_basics.sql` … `15_permissions.sql`). Har file ke liye:

1. File ka poora content copy karo → editor mein paste karo → **Run**
2. Neeche **"Success. No rows returned"** aana chahiye
3. Editor saaf karo (Ctrl+A → Delete), phir agla part

Order **01 → 15** hi rakhna. Koi part fail ho jaye toh error ka text bhejo. Har part dobara chalana safe hai.

> ⚠️ `supabase/tests/` wali files **Supabase par kabhi mat chalana** — woh sirf GitHub testing ke liye hain.

## Step 3 — Logins banana (5 min)

1. **Authentication → Sign In / Providers → Email** → "Allow new users to sign up" **OFF** → Save.
2. **Authentication → Users → Add user → Create new user**
   - Owner: owner ka email + strong password, "Auto Confirm User" ✓
   - Counter: counter ke liye ek alag email (jaise `vaishnavistore.counter@gmail.com`) + password, "Auto Confirm User" ✓
3. **SQL Editor** → `supabase/setup_team.sql` paste karo → `OWNER_EMAIL_HERE` aur `COUNTER_EMAIL_HERE` ko asli emails se replace karo → Run. Last table mein dono emails role ke saath dikhne chahiye.

## Step 4 — Keys copy karna (2 min)

**Project Settings → API** (ya **Connect** button):
- `Project URL` → yeh `NEXT_PUBLIC_SUPABASE_URL` hai
- `anon` / `publishable` key → yeh `NEXT_PUBLIC_SUPABASE_ANON_KEY` hai

❌ `service_role` / `secret` key kahin nahi daalni.

## Step 5 — Netlify (10 min)

1. Store ki Gmail se https://netlify.com → **Sign up** → **Add new project → Import an existing project → GitHub** → `vaishnavi-store` repo choose karo.
2. Build settings automatic aayenge (`npm run build`). **Environment variables** mein add karo:
   - `NEXT_PUBLIC_SUPABASE_URL` = Step 4 ka URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Step 4 ki anon key
3. **Deploy**. 2–4 minute mein site `https://<naam>.netlify.app` par live.
4. Site ka final address pata chalne ke baad ek aur variable add karo: `NEXT_PUBLIC_SITE_URL` = `https://<naam>.netlify.app` (domain lene ke baad use domain se badal dena) → **Deploys → Trigger deploy**.

## Step 6 — Pehli baar store set karna (owner, phone se)

1. `https://<site>/login` → owner email/password.
2. **Store & delivery**: address, WhatsApp number, timings (10–10), delivery fee ₹30, free delivery ₹350, ETA 30 min → **Save**.
3. **PIN codes**: 442001 pehle se hai.
4. **Categories** → banao (Atta & Rice, Dal, Oil & Ghee, Snacks…).
5. **Products → + Add product** → naam, category, size, price, stock → "Save & add photos" → photo khincho.

## Step 7 — Counter phone

1. Counter phone par Chrome mein `https://<site>/login` → counter email/password.
2. Chrome menu (⋮) → **Add to Home screen**.
3. Har din dukaan khulte hi app kholo → **🔔 Start shift** dabao (sound on hota hai). Phone charging par rakho, app khula rakho.
4. Volume full rakho. Test button se sound check karo.

## Step 8 — Test order (5 min)

1. Apne phone se site kholo → 1 product cart mein daalo (₹350 se kam) → checkout → PIN 442001 → COD → Place order.
2. Counter phone par awaaz aani chahiye.
3. Confirm → Out for delivery → Delivered → Cash collected.
4. Owner admin → **All orders** mein order dikhna chahiye.
5. Test order ko owner se **Cancel** kar do (stock wapas aa jayega).

## Optional — Nightly backup (5 min)

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
- `SUPABASE_DB_URL` = Supabase → **Connect** → "Session pooler" URI (`[YOUR-PASSWORD]` ki jagah Step 1 wala DB password)
- `BACKUP_PASSPHRASE` = lamba random passphrase (alag se safe likh ke rakho)

Phir **Actions → Nightly database backup → Run workflow** se ek baar test karo.

## Optional — Order emails (Resend, 10 min)

1. Supabase SQL Editor me `supabase/setup/17_coupons_sale_legal_email.sql` chalao (ek baar). Last me ek `notify_secret` dikhega — copy karo.
2. https://resend.com par shop ki Gmail se sign up karo → **API Keys → Create API key** (permission: Sending access) → key copy karo.
3. Netlify → Site configuration → Environment variables me add karo:
   - `RESEND_API_KEY` = Resend wali key
   - `NOTIFY_SECRET` = step 1 wala secret
   - `EMAIL_FROM` = abhi khaali chhodo (domain lene ke baad: `Vaishnavi E-Mart <orders@aapkadomain.in>`)
4. Netlify → Deploys → **Trigger deploy**.
5. Owner panel → Shop settings → **Order emails** me apni email daalo.

Domain verify hone tak Resend sirf aapke Resend account wali email par bhejta hai (owner alert kaam karega). Customer receipts ke liye Resend → Domains me apna domain verify karo, phir `EMAIL_FROM` set karo.

## Kuch galat ho toh

| Problem | Kya karein |
|---|---|
| Login par "does not have access" | Step 3 ka `setup_team.sql` dobara chalao, email spelling check karo |
| Site par "Store is being set up" | Netlify env variables check karo, phir redeploy |
| Order button disabled | Store closed (timing/switch) ya PIN code list mein nahi |
| Counter par awaaz nahi | "Start shift" dabaya? Phone silent/DND? App background mein to nahi? |
| Photo upload fail | Internet check karo; 6 photos se zyada nahi ho sakti |
