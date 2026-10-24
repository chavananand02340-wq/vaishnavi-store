-- Vaishnavi Store setup — part 10 of 15: Order tracking page + status changes
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

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
