-- Vaishnavi Store setup — part 13 of 15: Item not available (re-bill)
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- =====================================================================
-- Order handling + product search
-- =====================================================================

-- Packing found an item missing: mark it unavailable, put stock back and
-- recompute the bill with the same delivery rules that applied when the
-- order was placed (from settings_snapshot).
create or replace function public.mark_item_unavailable(p_order_id uuid, p_item_id bigint)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_role     public.staff_role := public.app_role();
  v_order    public.orders;
  v_item     public.order_items;
  v_subtotal integer;
  v_fee      integer;
  v_snap     jsonb;
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

  update public.orders
    set subtotal_paise = v_subtotal, delivery_fee_paise = v_fee, total_paise = v_subtotal + v_fee
    where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, v_order.status, v_order.status, auth.uid(),
          format('Item unavailable: %s (%s) x%s', v_item.product_name, v_item.variant_label, v_item.qty));

  return jsonb_build_object('ok', true, 'subtotal_paise', v_subtotal, 'delivery_fee_paise', v_fee,
                            'total_paise', v_subtotal + v_fee);
end $$;
