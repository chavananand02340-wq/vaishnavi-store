-- Vaishnavi Store setup — part 4 of 15: Orders, order items, status history
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- ---------- Orders ----------------------------------------------------
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_no           bigint generated always as identity (start with 1001) unique,
  public_token       uuid not null default gen_random_uuid() unique,
  idempotency_key    uuid not null unique,

  customer_name      text not null check (length(customer_name) between 2 and 80),
  phone              text not null check (phone ~ '^[6-9][0-9]{9}$'),
  address_line       text not null check (length(address_line) between 5 and 300),
  landmark           text check (length(landmark) <= 120),
  pincode            text not null check (pincode ~ '^[1-9][0-9]{5}$'),  -- no FK: PIN may be removed later
  instructions       text check (length(instructions) <= 300),

  subtotal_paise     integer not null check (subtotal_paise >= 0),
  delivery_fee_paise integer not null check (delivery_fee_paise >= 0),
  total_paise        integer not null check (total_paise = subtotal_paise + delivery_fee_paise),

  payment_method     public.payment_method not null,
  payment_status     public.payment_status not null default 'unpaid',
  upi_utr            text check (length(upi_utr) <= 40),

  status             public.order_status not null default 'new',
  eta_minutes        integer check (eta_minutes between 5 and 600),
  cancel_reason      text check (length(cancel_reason) <= 200),
  settings_snapshot  jsonb not null,

  created_at         timestamptz not null default now(),
  confirmed_at       timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at       timestamptz,
  cancelled_at       timestamptz,
  updated_at         timestamptz not null default now()
);
create index if not exists orders_status_idx  on public.orders (status, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.tg_set_updated_at();

create table if not exists public.order_items (
  id               bigint generated always as identity primary key,
  order_id         uuid not null references public.orders (id) on delete cascade,
  variant_id       uuid references public.product_variants (id) on delete set null,
  product_name     text not null,
  variant_label    text not null,
  unit_price_paise integer not null check (unit_price_paise > 0),
  qty              integer not null check (qty between 1 and 50),
  line_total_paise integer not null check (line_total_paise = unit_price_paise * qty),
  is_unavailable   boolean not null default false
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id);
