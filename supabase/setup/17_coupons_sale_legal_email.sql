-- Vaishnavi Store setup — part 17: Coupons, sale banner, legal details, order emails
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.
-- It also upgrades the checkout functions (parts 8, 9, 10, 13) to support coupons.
-- The last line shows a secret: copy it into Netlify as NOTIFY_SECRET.

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

-- ---------- Upgrade checkout functions --------------------------------
drop function if exists public.quote_cart(jsonb, text);
drop function if exists public._build_quote(text, jsonb);
drop function if exists public.place_order(uuid, text, text, text, text, public.payment_method, jsonb, integer, text, text, text);

-- Cart pricing with coupons
create or replace function public._build_quote(p_pincode text, p_items jsonb, p_coupon text default null)
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
  v_cp         public.coupons;
  v_code       text := nullif(upper(trim(coalesce(p_coupon, ''))), '');
  v_disc       integer := 0;
  v_coupon     jsonb := null;
  v_coupon_err text := null;
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

  -- Coupon (free-delivery threshold is judged on the subtotal before the coupon).
  if v_code is not null then
    select * into v_cp from public.coupons where code = v_code;
    if not found or not v_cp.is_active
       or (v_cp.starts_at is not null and v_cp.starts_at > now())
       or (v_cp.ends_at is not null and v_cp.ends_at < now()) then
      v_coupon_err := 'This coupon code is not valid right now.';
    elsif v_cp.usage_limit is not null and v_cp.used_count >= v_cp.usage_limit then
      v_coupon_err := 'This coupon has been fully used.';
    elsif v_subtotal < v_cp.min_order_paise then
      v_coupon_err := format('Add items worth Rs %s more to use %s.',
        rtrim(rtrim(to_char((v_cp.min_order_paise - v_subtotal) / 100.0, 'FM9999990.00'), '0'), '.'), v_cp.code);
    else
      v_disc := case when v_cp.kind = 'percent' then (v_subtotal * v_cp.value) / 100 else v_cp.value end;
      v_disc := least(v_disc, coalesce(v_cp.max_discount_paise, v_disc), v_subtotal);
      v_coupon := jsonb_build_object('code', v_cp.code, 'discount_paise', v_disc, 'description', v_cp.description,
        'kind', v_cp.kind, 'value', v_cp.value, 'max_discount_paise', v_cp.max_discount_paise, 'min_order_paise', v_cp.min_order_paise);
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lines', v_lines,
    'subtotal_paise', v_subtotal,
    'delivery_fee_paise', v_fee,
    'base_fee_paise', v_base_fee,
    'discount_paise', v_disc,
    'coupon', v_coupon,
    'coupon_error', v_coupon_err,
    'total_paise', v_subtotal - v_disc + v_fee,
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

create or replace function public.quote_cart(p_items jsonb, p_pincode text default null, p_coupon text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  return public._build_quote(nullif(trim(p_pincode), ''), p_items, p_coupon);
end $$;

-- Place order with coupon and optional email
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
  p_upi_utr              text default null,
  p_coupon_code          text default null,
  p_email                text default null
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
  v_code   text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  v_email  text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_cp     public.coupons;
  v_used   integer;
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

  if v_email is not null and (length(v_email) > 120 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_email', 'message', 'Please check your email address, or leave it empty.');
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

  if v_code is not null then
    -- Lock the coupon so its usage limit can't be overshot by two orders at once.
    select * into v_cp from public.coupons where code = v_code for update;
  end if;

  q := public._build_quote(v_pin, p_items, v_code);
  if not (q ->> 'ok')::boolean then
    return q;
  end if;
  if v_code is not null and q -> 'coupon' = 'null'::jsonb then
    return jsonb_build_object('ok', false, 'code', 'coupon_invalid',
      'message', coalesce(q ->> 'coupon_error', 'This coupon code is not valid.'), 'quote', q);
  end if;
  if v_code is not null and v_cp.per_phone_limit is not null then
    select count(*) into v_used from public.orders
      where coupon_code = v_code and phone = v_phone and status <> 'cancelled';
    if v_used >= v_cp.per_phone_limit then
      return jsonb_build_object('ok', false, 'code', 'coupon_invalid',
        'message', 'You have already used this coupon.', 'quote', q);
    end if;
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
      subtotal_paise, delivery_fee_paise, discount_paise, total_paise, coupon_code, customer_email,
      payment_method, payment_status, upi_utr, eta_minutes, settings_snapshot)
    values (
      p_idempotency_key, v_name, v_phone, v_addr, nullif(trim(p_landmark), ''), v_pin,
      nullif(trim(p_instructions), ''),
      (q ->> 'subtotal_paise')::integer, (q ->> 'delivery_fee_paise')::integer, (q ->> 'discount_paise')::integer,
      (q ->> 'total_paise')::integer, case when q -> 'coupon' <> 'null'::jsonb then v_code end, v_email,
      p_payment_method,
      case when p_payment_method = 'upi' then 'awaiting_verification'::public.payment_status else 'unpaid' end,
      nullif(trim(p_upi_utr), ''),
      s.default_eta_minutes,
      jsonb_build_object(
        'delivery_fee_paise', s.delivery_fee_paise,
        'base_fee_paise', (q ->> 'base_fee_paise')::integer,
        'free_delivery_enabled', s.free_delivery_enabled,
        'free_delivery_threshold_paise', s.free_delivery_threshold_paise,
        'cod_enabled', s.cod_enabled,
        'upi_id', case when p_payment_method = 'upi' then s.upi_id end,
        'coupon', q -> 'coupon'))
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

  if v_order.coupon_code is not null then
    update public.coupons set used_count = used_count + 1 where code = v_order.coupon_code;
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, note)
  values (v_order.id, null, 'new', 'Order placed');

  return jsonb_build_object('ok', true, 'duplicate', false,
    'order_no', v_order.order_no, 'public_token', v_order.public_token,
    'total_paise', v_order.total_paise, 'eta_minutes', v_order.eta_minutes);
end $$;

create or replace function public.get_order_by_token(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'created_at', o.created_at,
    'confirmed_at', o.confirmed_at, 'eta_minutes', o.eta_minutes,
    'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'subtotal_paise', o.subtotal_paise, 'delivery_fee_paise', o.delivery_fee_paise,
    'discount_paise', o.discount_paise, 'coupon_code', o.coupon_code,
    'total_paise', o.total_paise, 'customer_first_name', split_part(o.customer_name, ' ', 1),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name, 'variant_label', i.variant_label,
        'qty', i.qty, 'line_total_paise', i.line_total_paise, 'is_unavailable', i.is_unavailable)
        order by i.id)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o where o.public_token = p_token
$$;

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
    if v_order.coupon_code is not null then
      update public.coupons set used_count = greatest(used_count - 1, 0) where code = v_order.coupon_code;
    end if;
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, v_order.status, p_to, auth.uid(), nullif(trim(p_note), ''));

  return jsonb_build_object('ok', true, 'status', p_to);
end $$;

create or replace function public.mark_item_unavailable(p_order_id uuid, p_item_id bigint)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_role     public.staff_role := public.app_role();
  v_order    public.orders;
  v_item     public.order_items;
  v_subtotal integer;
  v_fee      integer;
  v_snap     jsonb;
  v_c        jsonb;
  v_disc     integer := 0;
  v_left     integer;
begin
  if v_role is null then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or (v_role = 'staff' and not public.staff_can_see(v_order.status, v_order.created_at)) then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Order not found.');
  end if;
  if v_order.status not in ('new', 'confirmed') then
    return jsonb_build_object('ok', false, 'code', 'too_late', 'message', 'Items can only be changed before the order leaves the store.');
  end if;

  select * into v_item from public.order_items where id = p_item_id and order_id = p_order_id for update;
  if not found or v_item.is_unavailable then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Item not found.');
  end if;

  select count(*) into v_left from public.order_items
    where order_id = p_order_id and not is_unavailable and id <> p_item_id;
  if v_left = 0 then
    return jsonb_build_object('ok', false, 'code', 'last_item',
      'message', 'This is the only item left. Ask the owner to cancel the order instead.');
  end if;

  update public.order_items set is_unavailable = true where id = p_item_id;
  if v_item.variant_id is not null then
    update public.product_variants set stock_qty = stock_qty + v_item.qty where id = v_item.variant_id;
  end if;

  select coalesce(sum(line_total_paise), 0) into v_subtotal
    from public.order_items where order_id = p_order_id and not is_unavailable;

  v_snap := v_order.settings_snapshot;
  if coalesce((v_snap ->> 'free_delivery_enabled')::boolean, false)
     and v_subtotal >= coalesce((v_snap ->> 'free_delivery_threshold_paise')::integer, 2147483647) then
    v_fee := 0;
  else
    v_fee := coalesce((v_snap ->> 'base_fee_paise')::integer, (v_snap ->> 'delivery_fee_paise')::integer, v_order.delivery_fee_paise);
  end if;

  -- Re-apply the order's coupon to the smaller bill (dropped if below its minimum).
  v_c := v_snap -> 'coupon';
  if v_c is not null and jsonb_typeof(v_c) = 'object' and v_subtotal >= coalesce((v_c ->> 'min_order_paise')::integer, 0) then
    v_disc := case when v_c ->> 'kind' = 'percent' then (v_subtotal * (v_c ->> 'value')::integer) / 100 else (v_c ->> 'value')::integer end;
    v_disc := least(v_disc, coalesce((v_c ->> 'max_discount_paise')::integer, v_disc), v_subtotal);
  end if;

  update public.orders
    set subtotal_paise = v_subtotal, delivery_fee_paise = v_fee, discount_paise = v_disc, total_paise = v_subtotal - v_disc + v_fee
    where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, v_order.status, v_order.status, auth.uid(),
          format('Item unavailable: %s (%s) x%s', v_item.product_name, v_item.variant_label, v_item.qty));

  return jsonb_build_object('ok', true, 'subtotal_paise', v_subtotal, 'delivery_fee_paise', v_fee,
                            'discount_paise', v_disc, 'total_paise', v_subtotal - v_disc + v_fee);
end $$;

-- ---------- Order emails (called by the website server with a secret) --
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.secrets (name text primary key, value text not null);
insert into private.secrets (name, value) values ('notify', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

-- Returns everything needed for the "new order" email, once per order.
create or replace function public.order_for_notify(p_token uuid, p_secret text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_order public.orders;
  s       public.store_settings;
begin
  if p_secret is null or p_secret <> (select value from private.secrets where name = 'notify') then
    return null;
  end if;
  update public.orders set notified_at = now()
    where public_token = p_token and notified_at is null
    returning * into v_order;
  if not found then
    return null;
  end if;
  select * into s from public.store_settings where id = 1;
  return jsonb_build_object(
    'order_no', v_order.order_no, 'public_token', v_order.public_token, 'created_at', v_order.created_at,
    'customer_name', v_order.customer_name, 'phone', v_order.phone, 'email', v_order.customer_email,
    'address_line', v_order.address_line, 'landmark', v_order.landmark, 'pincode', v_order.pincode,
    'instructions', v_order.instructions, 'payment_method', v_order.payment_method,
    'subtotal_paise', v_order.subtotal_paise, 'delivery_fee_paise', v_order.delivery_fee_paise,
    'discount_paise', v_order.discount_paise, 'coupon_code', v_order.coupon_code, 'total_paise', v_order.total_paise,
    'eta_minutes', v_order.eta_minutes,
    'store_name', s.store_name, 'notify_email', s.notify_email, 'support_email', s.support_email,
    'store_phone', s.phone_primary,
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.product_name, 'label', i.variant_label,
                 'qty', i.qty, 'line_total_paise', i.line_total_paise) order by i.id)
               from public.order_items i where i.order_id = v_order.id), '[]'::jsonb));
end $$;

-- ---------- Permissions for the new/changed functions -----------------
revoke execute on function public._build_quote(text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.quote_cart(jsonb, text, text) from public;
revoke execute on function public.place_order(uuid, text, text, text, text, public.payment_method, jsonb, integer, text, text, text, text, text) from public;
revoke execute on function public.order_for_notify(uuid, text) from public;
grant execute on function public.quote_cart(jsonb, text, text) to anon, authenticated;
grant execute on function public.place_order(uuid, text, text, text, text, public.payment_method, jsonb, integer, text, text, text, text, text) to anon, authenticated;
grant execute on function public.order_for_notify(uuid, text) to anon, authenticated;
grant execute on function public.get_order_by_token(uuid) to anon, authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text, integer) to authenticated;
grant execute on function public.mark_item_unavailable(uuid, bigint) to authenticated;

-- Copy this value into Netlify as NOTIFY_SECRET:
select value as notify_secret from private.secrets where name = 'notify';
