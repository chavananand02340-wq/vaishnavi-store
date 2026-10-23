-- =====================================================================
-- Vaishnavi Store — initial schema
-- All money is stored as integer PAISE (₹1 = 100 paise).
-- Security model:
--   * anon (customers): read active catalogue + public settings, and call
--     quote_cart / place_order / get_order_by_token. No direct table writes.
--   * staff: sees only active orders + today's orders; changes status only
--     through update_order_status().
--   * owner: full access to catalogue, settings and all orders.
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------- Enums ----------------------------------------------------
create type public.staff_role     as enum ('owner', 'staff');
create type public.order_status   as enum ('new', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled');
create type public.payment_method as enum ('cod', 'upi');
create type public.payment_status as enum ('unpaid', 'awaiting_verification', 'paid');

-- ---------- Common trigger: updated_at -------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Admin users ----------------------------------------------
create table public.admin_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         public.staff_role not null,
  display_name text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create or replace function public.app_role()
returns public.staff_role
language sql stable security definer set search_path = '' as $$
  select role from public.admin_users
  where user_id = auth.uid() and is_active
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_role() = 'owner', false)
$$;

create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_role() is not null
$$;

-- ---------- Store settings (single row) ------------------------------
create table public.store_settings (
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
  upi_id                        text check (upi_id ~ '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$'),
  upi_payee_name                text check (length(upi_payee_name) <= 80),

  low_stock_threshold           integer not null default 5 check (low_stock_threshold >= 0),
  updated_at                    timestamptz not null default now(),

  constraint upi_needs_id check (not upi_enabled or (upi_id is not null and upi_payee_name is not null))
);

create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.tg_set_updated_at();

-- ---------- Delivery PIN codes ---------------------------------------
create table public.delivery_pincodes (
  pincode            text primary key check (pincode ~ '^[1-9][0-9]{5}$'),
  area_name          text check (length(area_name) <= 80),
  is_active          boolean not null default true,
  fee_override_paise integer check (fee_override_paise >= 0),  -- NULL = use store default fee
  created_at         timestamptz not null default now()
);

-- ---------- Catalogue -------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 2 and 60),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.tg_set_updated_at();

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references public.categories (id) on delete restrict,
  name            text not null check (length(name) between 2 and 120),
  description     text check (length(description) <= 2000),
  search_keywords text check (length(search_keywords) <= 300),  -- e.g. "tel, oil, sunflower"
  is_active       boolean not null default true,
  is_featured     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_search_idx on public.products
  using gin ((name || ' ' || coalesce(search_keywords, '')) gin_trgm_ops);
create trigger products_updated_at before update on public.products
  for each row execute function public.tg_set_updated_at();

create table public.product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete cascade,
  label            text not null check (length(label) between 1 and 40),  -- "1 kg", "500 g"
  price_paise      integer not null check (price_paise > 0),
  mrp_paise        integer check (mrp_paise >= price_paise),
  sale_price_paise integer check (sale_price_paise > 0 and sale_price_paise < price_paise),
  sale_ends_at     timestamptz,
  stock_qty        integer not null default 0 check (stock_qty >= 0),
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  sku              text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id);
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.tg_set_updated_at();

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id);

-- ---------- Orders ----------------------------------------------------
create table public.orders (
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
create index orders_status_idx  on public.orders (status, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.tg_set_updated_at();

create table public.order_items (
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
create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid,
  note        text,
  created_at  timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id);

-- ---------- Audit log (owner-visible) --------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_id text;
begin
  v_id := coalesce(
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'id',
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'pincode'
  );
  insert into public.audit_log (actor, action, entity, entity_id, details)
  values (
    auth.uid(), lower(tg_op), tg_table_name, v_id,
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
      'new', case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end
    )
  );
  return null;
end $$;

create trigger audit_store_settings after update on public.store_settings
  for each row execute function public.tg_audit();
create trigger audit_delivery_pincodes after insert or update or delete on public.delivery_pincodes
  for each row execute function public.tg_audit();
create trigger audit_variant_price after update of price_paise, sale_price_paise, mrp_paise on public.product_variants
  for each row execute function public.tg_audit();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.admin_users          enable row level security;
alter table public.store_settings       enable row level security;
alter table public.delivery_pincodes    enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.product_variants     enable row level security;
alter table public.product_images       enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.audit_log            enable row level security;

-- admin_users: a member can read their own row; only the owner manages.
create policy admin_users_select on public.admin_users for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
create policy admin_users_owner_write on public.admin_users for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- store_settings: public read, owner update. Never insert/delete (single row).
create policy settings_read on public.store_settings for select to anon, authenticated using (true);
create policy settings_owner_update on public.store_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- delivery_pincodes: public sees active ones; owner manages all.
create policy pincodes_read on public.delivery_pincodes for select to anon, authenticated
  using (is_active or public.is_owner());
create policy pincodes_owner_write on public.delivery_pincodes for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- catalogue: public sees active rows; owner manages.
create policy categories_read on public.categories for select to anon, authenticated
  using (is_active or public.is_owner());
create policy categories_owner_write on public.categories for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy products_read on public.products for select to anon, authenticated
  using (is_active or public.is_owner());
create policy products_owner_write on public.products for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy variants_read on public.product_variants for select to anon, authenticated
  using (is_active or public.is_owner());
create policy variants_owner_write on public.product_variants for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy images_read on public.product_images for select to anon, authenticated using (true);
create policy images_owner_write on public.product_images for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- orders: owner sees all; staff sees active + today's (IST). No direct writes:
-- every change goes through a SECURITY DEFINER function below.
create or replace function public.staff_can_see(p_status public.order_status, p_created timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select p_status in ('new', 'confirmed', 'out_for_delivery')
      or (p_created at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
$$;

create policy orders_read on public.orders for select to authenticated
  using (public.is_owner() or (public.is_team_member() and public.staff_can_see(status, created_at)));

create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));  -- inherits orders RLS

create policy order_history_read on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy audit_owner_read on public.audit_log for select to authenticated
  using (public.is_owner());

-- Belt and braces: remove direct write privileges on order tables & audit.
revoke insert, update, delete on public.orders, public.order_items,
  public.order_status_history, public.audit_log from anon, authenticated;
revoke all on public.admin_users, public.audit_log, public.orders,
  public.order_items, public.order_status_history from anon;

-- =====================================================================
-- Pricing / checkout functions
-- =====================================================================

-- Is the store open right now (hours + manual switch)?
create or replace function public.store_is_open()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  s public.store_settings;
  t time;
begin
  select * into s from public.store_settings where id = 1;
  if not found or not s.accepting_orders then
    return false;
  end if;
  t := (now() at time zone s.timezone)::time;
  if s.open_time <= s.close_time then
    return t >= s.open_time and t < s.close_time;
  else  -- overnight hours, e.g. 18:00–02:00
    return t >= s.open_time or t < s.close_time;
  end if;
end $$;

-- Cart payload shape check, done before any cast so bad input can't raise errors.
create or replace function public._items_valid(p_items jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p_items is not null
     and jsonb_typeof(p_items) = 'array'
     and jsonb_array_length(p_items) between 1 and 60
     and not exists (
       select 1 from jsonb_array_elements(p_items) e
       where jsonb_typeof(e) <> 'object'
          or coalesce(e ->> 'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or coalesce(e ->> 'qty', '') !~ '^[1-9][0-9]?$'
          or (e ->> 'qty')::integer > 50)
$$;

-- Build a trusted quote from DB prices. p_items = [{"variant_id": uuid, "qty": int}, ...]
-- p_pincode may be NULL (cart page before the customer enters a PIN).
create or replace function public._build_quote(p_pincode text, p_items jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  s            public.store_settings;
  v_pin        public.delivery_pincodes;
  r            record;
  v_lines      jsonb := '[]'::jsonb;
  v_unavail    jsonb := '[]'::jsonb;
  v_short      jsonb := '[]'::jsonb;
  v_unit       integer;
  v_subtotal   integer := 0;
  v_fee        integer;
  v_base_fee   integer;
  v_count      integer;
begin
  select * into s from public.store_settings where id = 1;

  if not public._items_valid(p_items) then
    return jsonb_build_object('ok', false, 'code', 'invalid_items', 'message', 'Cart is invalid.');
  end if;

  select count(distinct e ->> 'variant_id') into v_count from jsonb_array_elements(p_items) e;
  if v_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'empty_cart', 'message', 'Your cart is empty.');
  end if;
  if v_count > 60 then
    return jsonb_build_object('ok', false, 'code', 'invalid_items', 'message', 'Too many items in one order.');
  end if;

  for r in
    with c as (
      select lower(e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'qty')::integer)::integer as qty
      from jsonb_array_elements(p_items) e
      group by 1
    )
    select c.variant_id, c.qty,
           v.id as vid, v.label, v.price_paise, v.sale_price_paise, v.sale_ends_at,
           v.stock_qty, v.is_active as v_active,
           p.name as product_name, p.is_active as p_active,
           cat.is_active as c_active
    from c
    left join public.product_variants v on v.id = c.variant_id
    left join public.products p on p.id = v.product_id
    left join public.categories cat on cat.id = p.category_id
    order by c.variant_id
  loop
    if r.qty > 50 then
      return jsonb_build_object('ok', false, 'code', 'invalid_items', 'message', 'Quantity must be between 1 and 50.');
    end if;
    if r.vid is null or not r.v_active or not r.p_active or not r.c_active then
      v_unavail := v_unavail || to_jsonb(r.variant_id);
      continue;
    end if;
    if r.stock_qty < r.qty then
      v_short := v_short || jsonb_build_object('variant_id', r.variant_id, 'available', r.stock_qty);
      continue;
    end if;
    v_unit := case
      when r.sale_price_paise is not null and (r.sale_ends_at is null or r.sale_ends_at > now())
        then r.sale_price_paise
      else r.price_paise
    end;
    v_subtotal := v_subtotal + v_unit * r.qty;
    v_lines := v_lines || jsonb_build_object(
      'variant_id', r.variant_id, 'product_name', r.product_name, 'variant_label', r.label,
      'unit_price_paise', v_unit, 'qty', r.qty, 'line_total_paise', v_unit * r.qty);
  end loop;

  if jsonb_array_length(v_unavail) > 0 or jsonb_array_length(v_short) > 0 then
    return jsonb_build_object('ok', false, 'code', 'items_changed',
      'message', 'Some items are no longer available in the quantity you selected.',
      'unavailable', v_unavail, 'insufficient_stock', v_short);
  end if;

  if p_pincode is not null then
    select * into v_pin from public.delivery_pincodes where pincode = p_pincode and is_active;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'pincode_unavailable',
        'message', 'Sorry, we do not deliver to this PIN code yet.');
    end if;
  end if;

  -- Delivery fee rule (documented in README):
  --   base fee = PIN override if set, else store fee
  --   fee = 0 when free delivery is enabled AND subtotal >= threshold, else base fee
  v_base_fee := coalesce(v_pin.fee_override_paise, s.delivery_fee_paise);
  if s.free_delivery_enabled and v_subtotal >= s.free_delivery_threshold_paise then
    v_fee := 0;
  else
    v_fee := v_base_fee;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lines', v_lines,
    'subtotal_paise', v_subtotal,
    'delivery_fee_paise', v_fee,
    'total_paise', v_subtotal + v_fee,
    'free_delivery_remaining_paise',
      case when s.free_delivery_enabled and v_subtotal < s.free_delivery_threshold_paise
           then s.free_delivery_threshold_paise - v_subtotal else 0 end,
    'below_min_order', s.min_order_paise is not null and v_subtotal < s.min_order_paise,
    'min_order_paise', s.min_order_paise,
    'cod_available', s.cod_enabled,
    'upi_available', s.upi_enabled,
    'store_open', public.store_is_open(),
    'eta_minutes', s.default_eta_minutes
  );
end $$;

-- Public: price a cart (no side effects).
create or replace function public.quote_cart(p_items jsonb, p_pincode text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  return public._build_quote(nullif(trim(p_pincode), ''), p_items);
end $$;

-- Public: place an order. Every amount is recomputed here; the browser only
-- sends variant ids + quantities. p_expected_total_paise is what the customer
-- saw; if the trusted total differs we return 'price_changed' instead of
-- creating the order, so the customer can confirm the new total.
create or replace function public.place_order(
  p_idempotency_key      uuid,
  p_customer_name        text,
  p_phone                text,
  p_address_line         text,
  p_pincode              text,
  p_payment_method       public.payment_method,
  p_items                jsonb,
  p_expected_total_paise integer,
  p_landmark             text default null,
  p_instructions         text default null,
  p_upi_utr              text default null
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  s        public.store_settings;
  q        jsonb;
  v_phone  text;
  v_order  public.orders;
  v_line   jsonb;
  v_name   text := trim(p_customer_name);
  v_addr   text := trim(p_address_line);
  v_pin    text := trim(p_pincode);
begin
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_request', 'message', 'Please refresh and try again.');
  end if;

  -- Duplicate submit / network retry: return the order already created.
  select * into v_order from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true,
      'order_no', v_order.order_no, 'public_token', v_order.public_token, 'total_paise', v_order.total_paise);
  end if;

  select * into s from public.store_settings where id = 1 for share;

  if not public.store_is_open() then
    return jsonb_build_object('ok', false, 'code', 'store_closed',
      'message', coalesce(s.closed_message, 'The store is not accepting orders right now.'));
  end if;

  -- Normalise phone: keep digits, drop +91 / 0 prefix.
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then v_phone := right(v_phone, 10); end if;
  if length(v_phone) = 11 and left(v_phone, 1) = '0'  then v_phone := right(v_phone, 10); end if;

  if v_name is null or length(v_name) not between 2 and 80 then
    return jsonb_build_object('ok', false, 'code', 'invalid_name', 'message', 'Please enter your name.');
  end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_phone', 'message', 'Please enter a valid 10-digit mobile number.');
  end if;
  if v_addr is null or length(v_addr) not between 5 and 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid_address', 'message', 'Please enter your full address.');
  end if;
  if v_pin is null or v_pin !~ '^[1-9][0-9]{5}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_pincode', 'message', 'Please enter a valid 6-digit PIN code.');
  end if;
  if length(coalesce(p_landmark, '')) > 120 or length(coalesce(p_instructions, '')) > 300
     or length(coalesce(p_upi_utr, '')) > 40 then
    return jsonb_build_object('ok', false, 'code', 'too_long', 'message', 'Some details are too long.');
  end if;

  if p_payment_method = 'cod' and not s.cod_enabled then
    return jsonb_build_object('ok', false, 'code', 'cod_disabled', 'message', 'Cash on Delivery is not available right now.');
  end if;
  if p_payment_method = 'upi' and not s.upi_enabled then
    return jsonb_build_object('ok', false, 'code', 'upi_disabled', 'message', 'UPI payment is not available right now.');
  end if;

  if not public._items_valid(p_items) then
    return jsonb_build_object('ok', false, 'code', 'invalid_items', 'message', 'Cart is invalid.');
  end if;

  -- Lock the variants we are about to sell so two orders cannot oversell.
  perform 1 from public.product_variants
    where id in (select (e ->> 'variant_id')::uuid from jsonb_array_elements(p_items) e)
    order by id
    for update;

  q := public._build_quote(v_pin, p_items);
  if not (q ->> 'ok')::boolean then
    return q;
  end if;
  if (q ->> 'below_min_order')::boolean then
    return jsonb_build_object('ok', false, 'code', 'below_min_order',
      'message', 'Order is below the minimum amount.', 'min_order_paise', s.min_order_paise);
  end if;
  if p_expected_total_paise is distinct from (q ->> 'total_paise')::integer then
    return jsonb_build_object('ok', false, 'code', 'price_changed',
      'message', 'Prices or delivery charges have changed. Please review your new total.', 'quote', q);
  end if;

  begin
    insert into public.orders (
      idempotency_key, customer_name, phone, address_line, landmark, pincode, instructions,
      subtotal_paise, delivery_fee_paise, total_paise,
      payment_method, payment_status, upi_utr, eta_minutes, settings_snapshot)
    values (
      p_idempotency_key, v_name, v_phone, v_addr, nullif(trim(p_landmark), ''), v_pin,
      nullif(trim(p_instructions), ''),
      (q ->> 'subtotal_paise')::integer, (q ->> 'delivery_fee_paise')::integer, (q ->> 'total_paise')::integer,
      p_payment_method,
      case when p_payment_method = 'upi' then 'awaiting_verification'::public.payment_status else 'unpaid' end,
      nullif(trim(p_upi_utr), ''),
      s.default_eta_minutes,
      jsonb_build_object(
        'delivery_fee_paise', s.delivery_fee_paise,
        'free_delivery_enabled', s.free_delivery_enabled,
        'free_delivery_threshold_paise', s.free_delivery_threshold_paise,
        'cod_enabled', s.cod_enabled,
        'upi_id', case when p_payment_method = 'upi' then s.upi_id end))
    returning * into v_order;
  exception when unique_violation then
    select * into v_order from public.orders where idempotency_key = p_idempotency_key;
    return jsonb_build_object('ok', true, 'duplicate', true,
      'order_no', v_order.order_no, 'public_token', v_order.public_token, 'total_paise', v_order.total_paise);
  end;

  for v_line in select * from jsonb_array_elements(q -> 'lines') loop
    insert into public.order_items (order_id, variant_id, product_name, variant_label, unit_price_paise, qty, line_total_paise)
    values (v_order.id, (v_line ->> 'variant_id')::uuid, v_line ->> 'product_name', v_line ->> 'variant_label',
            (v_line ->> 'unit_price_paise')::integer, (v_line ->> 'qty')::integer, (v_line ->> 'line_total_paise')::integer);
    update public.product_variants
      set stock_qty = stock_qty - (v_line ->> 'qty')::integer
      where id = (v_line ->> 'variant_id')::uuid;
  end loop;

  insert into public.order_status_history (order_id, from_status, to_status, note)
  values (v_order.id, null, 'new', 'Order placed');

  return jsonb_build_object('ok', true, 'duplicate', false,
    'order_no', v_order.order_no, 'public_token', v_order.public_token,
    'total_paise', v_order.total_paise, 'eta_minutes', v_order.eta_minutes);
end $$;

-- Public: order confirmation / tracking page by secret token.
-- Returns no phone number or address.
create or replace function public.get_order_by_token(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'created_at', o.created_at,
    'confirmed_at', o.confirmed_at, 'eta_minutes', o.eta_minutes,
    'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'subtotal_paise', o.subtotal_paise, 'delivery_fee_paise', o.delivery_fee_paise,
    'total_paise', o.total_paise, 'customer_first_name', split_part(o.customer_name, ' ', 1),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name, 'variant_label', i.variant_label,
        'qty', i.qty, 'line_total_paise', i.line_total_paise, 'is_unavailable', i.is_unavailable)
        order by i.id)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o where o.public_token = p_token
$$;

-- =====================================================================
-- Team functions (owner + staff)
-- =====================================================================

-- Allowed transitions. Only the owner can cancel.
create or replace function public.update_order_status(
  p_order_id uuid, p_to public.order_status, p_note text default null, p_eta_minutes integer default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_role  public.staff_role := public.app_role();
  v_order public.orders;
  v_ok    boolean;
begin
  if v_role is null then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or (v_role = 'staff' and not public.staff_can_see(v_order.status, v_order.created_at)) then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Order not found.');
  end if;

  v_ok := case
    when p_to = 'cancelled' then v_role = 'owner' and v_order.status not in ('delivered', 'cancelled')
    when v_order.status = 'new'              then p_to = 'confirmed'
    when v_order.status = 'confirmed'        then p_to = 'out_for_delivery'
    when v_order.status = 'out_for_delivery' then p_to = 'delivered'
    else false
  end;
  if not v_ok then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition',
      'message', format('Cannot change order from %s to %s.', v_order.status, p_to));
  end if;
  if p_to = 'cancelled' and coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'reason_required', 'message', 'Please give a reason for cancelling.');
  end if;
  if p_eta_minutes is not null and p_eta_minutes not between 5 and 600 then
    return jsonb_build_object('ok', false, 'code', 'invalid_eta', 'message', 'ETA must be between 5 and 600 minutes.');
  end if;

  update public.orders set
    status              = p_to,
    eta_minutes         = coalesce(p_eta_minutes, eta_minutes),
    confirmed_at        = case when p_to = 'confirmed'        then now() else confirmed_at end,
    out_for_delivery_at = case when p_to = 'out_for_delivery' then now() else out_for_delivery_at end,
    delivered_at        = case when p_to = 'delivered'        then now() else delivered_at end,
    cancelled_at        = case when p_to = 'cancelled'        then now() else cancelled_at end,
    cancel_reason       = case when p_to = 'cancelled'        then left(trim(p_note), 200) else cancel_reason end
  where id = p_order_id;

  -- Put stock back when an order is cancelled.
  if p_to = 'cancelled' then
    update public.product_variants v
      set stock_qty = v.stock_qty + i.qty
      from public.order_items i
      where i.order_id = p_order_id and i.variant_id = v.id and not i.is_unavailable;
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, v_order.status, p_to, auth.uid(), nullif(trim(p_note), ''));

  return jsonb_build_object('ok', true, 'status', p_to);
end $$;

-- Payment: staff may only mark COD cash as collected; the owner verifies UPI.
create or replace function public.set_payment_status(p_order_id uuid, p_status public.payment_status)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_role  public.staff_role := public.app_role();
  v_order public.orders;
begin
  if v_role is null then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or (v_role = 'staff' and not public.staff_can_see(v_order.status, v_order.created_at)) then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Order not found.');
  end if;
  if v_role = 'staff' and not (v_order.payment_method = 'cod' and p_status = 'paid') then
    return jsonb_build_object('ok', false, 'code', 'owner_only', 'message', 'Only the owner can change this payment.');
  end if;

  update public.orders set payment_status = p_status where id = p_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, v_order.status, v_order.status, auth.uid(), 'Payment: ' || p_status::text);
  return jsonb_build_object('ok', true, 'payment_status', p_status);
end $$;

-- ---------- Function privileges --------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.store_is_open()                    to anon, authenticated;
grant execute on function public.quote_cart(jsonb, text)            to anon, authenticated;
grant execute on function public.place_order(uuid, text, text, text, text, public.payment_method, jsonb, integer, text, text, text)
                                                                     to anon, authenticated;
grant execute on function public.get_order_by_token(uuid)           to anon, authenticated;

grant execute on function public.app_role()                         to authenticated;
grant execute on function public.is_owner()                         to anon, authenticated;
grant execute on function public.is_team_member()                   to anon, authenticated;
grant execute on function public.staff_can_see(public.order_status, timestamptz) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text, integer) to authenticated;
grant execute on function public.set_payment_status(uuid, public.payment_status) to authenticated;

-- =====================================================================
-- Initial data (confirmed in the brief)
-- =====================================================================
insert into public.store_settings (id, store_name, phone_primary, phone_secondary, instagram_url, maps_url)
values (1, 'Vaishnavi Store', '9890550785', '8482891640',
        'https://www.instagram.com/vaish.navi_store/', 'https://maps.app.goo.gl/CEXEdHUxKe8hmWmk7')
on conflict (id) do nothing;

insert into public.delivery_pincodes (pincode, is_active) values ('442001', true)
on conflict (pincode) do nothing;
