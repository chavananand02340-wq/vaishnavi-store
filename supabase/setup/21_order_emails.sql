-- Vaishnavi Store setup — part 21: Order email secret
-- Run in Supabase → SQL Editor, after part 20. Safe to run again.
-- The last line shows a secret: copy it into Netlify as NOTIFY_SECRET.
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

revoke execute on function public.order_for_notify(uuid, text) from public;
grant execute on function public.order_for_notify(uuid, text) to anon, authenticated;

-- Copy this value into Netlify as NOTIFY_SECRET:
select value as notify_secret from private.secrets where name = 'notify';
