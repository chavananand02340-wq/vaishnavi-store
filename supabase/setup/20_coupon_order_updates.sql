-- Vaishnavi Store setup — part 20: Order tracking and status changes with coupons
-- Run in Supabase → SQL Editor, after part 19. Safe to run again.
-- Replaces parts 10 and 13 functions.
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


grant execute on function public.get_order_by_token(uuid) to anon, authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text, integer) to authenticated;
grant execute on function public.mark_item_unavailable(uuid, bigint) to authenticated;
