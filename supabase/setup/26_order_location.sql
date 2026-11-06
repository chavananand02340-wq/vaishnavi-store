-- Vaishnavi Store setup — part 26: Customer's exact location (optional "Use my location" at checkout)
-- Run in Supabase → SQL Editor, after part 25. Safe to run again.

alter table public.orders add column if not exists delivery_lat double precision;
alter table public.orders add column if not exists delivery_lng double precision;
alter table public.orders add column if not exists location_accuracy_m integer;

do $$ begin
  alter table public.orders add constraint orders_location_in_india check (
    (delivery_lat is null and delivery_lng is null)
    or (delivery_lat between 6 and 38 and delivery_lng between 68 and 98));
exception when duplicate_object then null;
end $$;

-- The customer's phone attaches its location to the order it just placed (once, within 2 hours).
create or replace function public.set_order_location(p_token uuid, p_lat double precision, p_lng double precision, p_accuracy_m integer default null)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_lat is null or p_lng is null or p_lat not between 6 and 38 or p_lng not between 68 and 98 then
    return false;
  end if;
  update public.orders
     set delivery_lat = round(p_lat::numeric, 6), delivery_lng = round(p_lng::numeric, 6),
         location_accuracy_m = least(greatest(coalesce(p_accuracy_m, 0), 0), 100000)
   where public_token = p_token and delivery_lat is null
     and created_at > now() - interval '2 hours' and status <> 'cancelled';
  return found;
end $$;

-- Order emails include the map location.
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
    'lat', o.delivery_lat, 'lng', o.delivery_lng, 'location_accuracy_m', o.location_accuracy_m,
    'store_phone', s.phone_primary, 'store_whatsapp', s.whatsapp_number, 'store_address', s.address,
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.product_name, 'label', i.variant_label,
                 'qty', i.qty, 'unit_price_paise', i.unit_price_paise, 'line_total_paise', i.line_total_paise,
                 'unavailable', i.is_unavailable) order by i.id)
               from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o cross join public.store_settings s
  where o.id = p_order_id and s.id = 1;
$$;
revoke all on function private.order_email_json(uuid) from public, anon, authenticated;
revoke execute on function public.set_order_location(uuid, double precision, double precision, integer) from public;
grant execute on function public.set_order_location(uuid, double precision, double precision, integer) to anon, authenticated;
