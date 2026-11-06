-- Vaishnavi Store setup — part 23: "We're packing your order" email + richer order emails
-- Run in Supabase → SQL Editor, after part 22. Safe to run again.
-- If you already ran part 26, run 26 again after this (it adds the map location to emails).

alter table public.orders add column if not exists packing_notified_at timestamptz;

-- Everything an order email needs, as JSON (internal helper).
create or replace function private.order_email_json(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'public_token', o.public_token, 'created_at', o.created_at,
    'confirmed_at', o.confirmed_at, 'status', o.status,
    'customer_name', o.customer_name, 'phone', o.phone, 'email', o.customer_email,
    'address_line', o.address_line, 'landmark', o.landmark, 'pincode', o.pincode,
    'instructions', o.instructions, 'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'subtotal_paise', o.subtotal_paise, 'delivery_fee_paise', o.delivery_fee_paise,
    'discount_paise', o.discount_paise, 'coupon_code', o.coupon_code, 'total_paise', o.total_paise,
    'eta_minutes', coalesce(o.eta_minutes, s.default_eta_minutes),
    'store_name', s.store_name, 'notify_email', s.notify_email, 'support_email', s.support_email,
    'store_phone', s.phone_primary, 'store_whatsapp', s.whatsapp_number, 'store_address', s.address,
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.product_name, 'label', i.variant_label,
                 'qty', i.qty, 'unit_price_paise', i.unit_price_paise, 'line_total_paise', i.line_total_paise,
                 'unavailable', i.is_unavailable) order by i.id)
               from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o cross join public.store_settings s
  where o.id = p_order_id and s.id = 1;
$$;
revoke all on function private.order_email_json(uuid) from public, anon, authenticated;

-- New order: returns details once (for the customer receipt + owner alert).
create or replace function public.order_for_notify(p_token uuid, p_secret text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_secret is null or p_secret <> (select value from private.secrets where name = 'notify') then
    return null;
  end if;
  update public.orders set notified_at = now()
    where public_token = p_token and notified_at is null
    returning id into v_id;
  if v_id is null then return null; end if;
  return private.order_email_json(v_id);
end $$;

-- Order accepted: returns details once, only when it is now "packing" and has an email.
create or replace function public.order_for_packing_email(p_token uuid, p_secret text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_secret is null or p_secret <> (select value from private.secrets where name = 'notify') then
    return null;
  end if;
  update public.orders set packing_notified_at = now()
    where public_token = p_token and packing_notified_at is null
      and status = 'confirmed' and customer_email is not null
    returning id into v_id;
  if v_id is null then return null; end if;
  return private.order_email_json(v_id);
end $$;

revoke execute on function public.order_for_notify(uuid, text) from public;
revoke execute on function public.order_for_packing_email(uuid, text) from public;
grant execute on function public.order_for_notify(uuid, text) to anon, authenticated;
grant execute on function public.order_for_packing_email(uuid, text) to anon, authenticated;
