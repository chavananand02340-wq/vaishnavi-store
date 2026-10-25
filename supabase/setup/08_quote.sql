-- Vaishnavi Store setup — part 8 of 15: Cart pricing (delivery fee logic)
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.
-- NOTE: part 18 replaces this function with a coupon-aware version.
-- If you already ran parts 17-21, don't run this part again.

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
    'base_fee_paise', v_base_fee,
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
