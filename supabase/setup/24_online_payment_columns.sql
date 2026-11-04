-- Vaishnavi Store setup — part 24: Online payment (Razorpay) — new columns
-- Run in Supabase → SQL Editor, after part 23. Safe to run again.
-- Run part 25 right after this one.

alter type public.payment_method add value if not exists 'online';

alter table public.store_settings add column if not exists razorpay_enabled boolean not null default false;

alter table public.orders add column if not exists razorpay_order_id text;
alter table public.orders add column if not exists razorpay_payment_id text;
alter table public.orders add column if not exists paid_at timestamptz;
create unique index if not exists orders_razorpay_order_id_key on public.orders (razorpay_order_id) where razorpay_order_id is not null;
