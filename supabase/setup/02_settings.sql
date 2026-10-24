-- Vaishnavi Store setup — part 2 of 15: Store settings and delivery PIN codes
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- ---------- Store settings (single row) ------------------------------
create table if not exists public.store_settings (
  id                            smallint primary key default 1 check (id = 1),
  store_name                    text not null default 'Vaishnavi Store' check (length(store_name) between 2 and 80),
  tagline                       text check (length(tagline) <= 120),
  address                       text check (length(address) <= 300),
  phone_primary                 text check (phone_primary ~ '^[6-9][0-9]{9}$'),
  phone_secondary               text check (phone_secondary ~ '^[6-9][0-9]{9}$'),
  whatsapp_number               text check (whatsapp_number ~ '^[6-9][0-9]{9}$'),
  email                         text check (length(email) <= 120),
  instagram_url                 text check (length(instagram_url) <= 300),
  maps_url                      text check (length(maps_url) <= 300),

  timezone                      text not null default 'Asia/Kolkata',
  open_time                     time not null default '10:00',
  close_time                    time not null default '22:00',
  accepting_orders              boolean not null default true,
  closed_message                text check (length(closed_message) <= 200),
  announcement                  text check (length(announcement) <= 200),

  delivery_fee_paise            integer not null default 3000  check (delivery_fee_paise >= 0),
  free_delivery_enabled         boolean not null default true,
  free_delivery_threshold_paise integer not null default 35000 check (free_delivery_threshold_paise >= 0),
  min_order_paise               integer check (min_order_paise >= 0),  -- NULL = no minimum
  default_eta_minutes           integer not null default 30 check (default_eta_minutes between 5 and 600),

  cod_enabled                   boolean not null default true,
  upi_enabled                   boolean not null default false,
  upi_id                        text check (upi_id ~ '^[a-zA-Z0-9.\-_]{2,200}@[a-zA-Z]{2,64}$'),
  upi_payee_name                text check (length(upi_payee_name) <= 80),

  low_stock_threshold           integer not null default 5 check (low_stock_threshold >= 0),
  updated_at                    timestamptz not null default now(),

  constraint upi_needs_id check (not upi_enabled or (upi_id is not null and upi_payee_name is not null))
);

drop trigger if exists store_settings_updated_at on public.store_settings;
create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.tg_set_updated_at();

-- ---------- Delivery PIN codes ---------------------------------------
create table if not exists public.delivery_pincodes (
  pincode            text primary key check (pincode ~ '^[1-9][0-9]{5}$'),
  area_name          text check (length(area_name) <= 80),
  is_active          boolean not null default true,
  fee_override_paise integer check (fee_override_paise >= 0),  -- NULL = use store default fee
  created_at         timestamptz not null default now()
);
