-- Vaishnavi Store setup — part 18: Cart pricing with coupons
-- Run in Supabase → SQL Editor, after part 17. Safe to run again.
-- Replaces part 8. Do not run part 8 again after this.
-- ---------- Upgrade checkout functions --------------------------------
drop function if exists public.quote_cart(jsonb, text);
drop function if exists public._build_quote(text, jsonb);

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

revoke execute on function public._build_quote(text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.quote_cart(jsonb, text, text) from public;
grant execute on function public.quote_cart(jsonb, text, text) to anon, authenticated;
