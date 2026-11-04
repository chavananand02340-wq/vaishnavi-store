-- Vaishnavi Store setup — part 25: Online payment (Razorpay) — functions
-- Run in Supabase → SQL Editor, after part 24. Safe to run again.
-- The website server uses the same NOTIFY_SECRET (part 21) to call these.

-- Cart pricing also says whether online payment is on.
create or replace function public.quote_cart(p_items jsonb, p_pincode text default null, p_coupon text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare q jsonb;
begin
  q := public._build_quote(nullif(trim(p_pincode), ''), p_items, p_coupon);
  if (q ->> 'ok')::boolean then
    q := q || jsonb_build_object('online_available', (select razorpay_enabled from public.store_settings where id = 1));
  end if;
  return q;
end $$;

-- Guard: online orders only while online payment is switched on.
create or replace function private.orders_online_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payment_method = 'online'
     and not coalesce((select razorpay_enabled from public.store_settings where id = 1), false) then
    raise exception 'Online payment is not available right now.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists orders_online_guard on public.orders;
create trigger orders_online_guard before insert on public.orders
  for each row execute function private.orders_online_guard();

-- What the server needs to start a payment.
create or replace function public.order_for_payment(p_token uuid, p_secret text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o public.orders;
begin
  if p_secret is null or p_secret <> (select value from private.secrets where name = 'notify') then
    return null;
  end if;
  select * into o from public.orders where public_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'order_no', o.order_no, 'total_paise', o.total_paise, 'status', o.status,
    'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'razorpay_order_id', o.razorpay_order_id,
    'customer_name', o.customer_name, 'phone', o.phone, 'email', o.customer_email,
    'store_name', (select store_name from public.store_settings where id = 1));
end $$;

-- Remember the Razorpay order created for this order.
create or replace function public.set_razorpay_order(p_token uuid, p_secret text, p_rp_order text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret <> (select value from private.secrets where name = 'notify') then
    return false;
  end if;
  update public.orders set razorpay_order_id = p_rp_order
    where public_token = p_token and payment_method = 'online' and payment_status <> 'paid' and status <> 'cancelled';
  return found;
end $$;

-- Mark paid after the server checked Razorpay's signature. Amount must match. Safe to call twice.
create or replace function public.mark_online_paid(p_secret text, p_rp_order text, p_rp_payment text, p_amount_paise integer)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare o public.orders;
begin
  if p_secret is null or p_secret <> (select value from private.secrets where name = 'notify') then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  select * into o from public.orders where razorpay_order_id = p_rp_order for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if o.payment_status = 'paid' then
    return jsonb_build_object('ok', true, 'already', true, 'public_token', o.public_token);
  end if;
  if p_amount_paise is distinct from o.total_paise then
    return jsonb_build_object('ok', false, 'code', 'amount_mismatch');
  end if;
  update public.orders set payment_status = 'paid', paid_at = now(), razorpay_payment_id = p_rp_payment
    where id = o.id;
  insert into public.order_status_history (order_id, from_status, to_status, note)
    values (o.id, o.status, o.status, 'Paid online (Razorpay ' || coalesce(p_rp_payment, '') || ')');
  return jsonb_build_object('ok', true, 'public_token', o.public_token);
end $$;

revoke all on function private.orders_online_guard() from public, anon, authenticated;
revoke execute on function public.order_for_payment(uuid, text) from public;
revoke execute on function public.set_razorpay_order(uuid, text, text) from public;
revoke execute on function public.mark_online_paid(text, text, text, integer) from public;
grant execute on function public.quote_cart(jsonb, text, text) to anon, authenticated;
grant execute on function public.order_for_payment(uuid, text) to anon, authenticated;
grant execute on function public.set_razorpay_order(uuid, text, text) to anon, authenticated;
grant execute on function public.mark_online_paid(text, text, text, integer) to anon, authenticated;
