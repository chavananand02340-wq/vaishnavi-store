-- Vaishnavi Store setup — part 17: Coupons table, sale banner and legal settings
-- Run in Supabase → SQL Editor, after part 16. Safe to run again.

-- ---------- Coupons --------------------------------------------------
create table if not exists public.coupons (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  description        text check (length(description) <= 140),
  kind               text not null check (kind in ('percent', 'flat')),
  value              integer not null check (value > 0),
  min_order_paise    integer not null default 0 check (min_order_paise >= 0),
  max_discount_paise integer check (max_discount_paise > 0),
  starts_at          timestamptz,
  ends_at            timestamptz,
  usage_limit        integer check (usage_limit > 0),
  used_count         integer not null default 0 check (used_count >= 0),
  per_phone_limit    integer check (per_phone_limit > 0),
  show_in_checkout   boolean not null default true,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  constraint coupon_percent_range check (kind <> 'percent' or value between 1 and 90)
);

alter table public.coupons enable row level security;
drop policy if exists coupons_read on public.coupons;
create policy coupons_read on public.coupons for select to anon, authenticated
  using (
    public.is_owner()
    or (is_active and show_in_checkout
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at > now())
        and (usage_limit is null or used_count < usage_limit))
  );
drop policy if exists coupons_owner_write on public.coupons;
create policy coupons_owner_write on public.coupons for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
grant select on public.coupons to anon, authenticated;
grant insert, update, delete on public.coupons to authenticated;

-- ---------- Orders: coupon, discount, customer email ------------------
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_paise integer not null default 0;
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists notified_at timestamptz;
alter table public.orders drop constraint if exists orders_check;
alter table public.orders drop constraint if exists orders_total_with_discount;
alter table public.orders add constraint orders_total_with_discount
  check (discount_paise >= 0 and total_paise = subtotal_paise - discount_paise + delivery_fee_paise);

-- ---------- Settings: top sale banner, legal details, order email -----
alter table public.store_settings add column if not exists sale_enabled boolean not null default false;
alter table public.store_settings add column if not exists sale_title text;
alter table public.store_settings add column if not exists sale_subtitle text;
alter table public.store_settings add column if not exists sale_percent integer;
alter table public.store_settings add column if not exists sale_coupon_code text;
alter table public.store_settings add column if not exists sale_theme text not null default 'festive';
alter table public.store_settings add column if not exists legal_name text;
alter table public.store_settings add column if not exists gstin text;
alter table public.store_settings add column if not exists fssai_number text;
alter table public.store_settings add column if not exists support_email text;
alter table public.store_settings add column if not exists notify_email text;
do $$ begin
  alter table public.store_settings add constraint settings_sale_checks check (
    (sale_percent is null or sale_percent between 1 and 90)
    and length(coalesce(sale_title, '')) <= 60 and length(coalesce(sale_subtitle, '')) <= 120
    and sale_theme in ('festive', 'red', 'green', 'night')
    and length(coalesce(legal_name, '')) <= 120 and length(coalesce(gstin, '')) <= 20
    and length(coalesce(fssai_number, '')) <= 20 and length(coalesce(support_email, '')) <= 120
    and length(coalesce(notify_email, '')) <= 120);
exception when duplicate_object then null;
end $$;

