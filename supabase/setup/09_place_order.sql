-- Vaishnavi Store setup — part 9 of 15: Place order (server-side checkout)
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

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
        'base_fee_paise', (q ->> 'base_fee_paise')::integer,
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
