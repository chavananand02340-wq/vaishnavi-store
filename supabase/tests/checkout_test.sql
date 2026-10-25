-- Database tests for pricing, checkout and permissions. Run on a throwaway
-- database after supabase_stubs.sql + supabase/setup/*.sql (CI does this). Each check
-- raises an exception on failure.

create or replace function pg_temp.check(cond boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'TEST FAILED: %', what; end if;
  raise notice 'ok - %', what;
end $$;

-- fixtures ---------------------------------------------------------------
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
insert into public.admin_users (user_id, role, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'owner', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'staff', 'Counter');
update public.store_settings set open_time = '00:00', close_time = '23:59:59';
insert into public.categories (id, name, slug) values ('c0000000-0000-0000-0000-000000000001', 'Test', 'test');
insert into public.products (id, category_id, name, search_keywords) values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Fortune Sunflower Oil', 'tel');
insert into public.product_variants (id, product_id, label, price_paise, stock_qty) values
  ('b0000000-0000-0000-0000-000000000100', 'a0000000-0000-0000-0000-000000000001', 'A', 10000, 10),
  ('b0000000-0000-0000-0000-000000000200', 'a0000000-0000-0000-0000-000000000001', 'B', 20000, 10),
  ('b0000000-0000-0000-0000-000000000349', 'a0000000-0000-0000-0000-000000000001', 'C', 34900, 10),
  ('b0000000-0000-0000-0000-000000000350', 'a0000000-0000-0000-0000-000000000001', 'D', 35000, 10),
  ('b0000000-0000-0000-0000-000000000500', 'a0000000-0000-0000-0000-000000000001', 'E', 50000, 1);

-- customer (anon) --------------------------------------------------------
set role anon;

select pg_temp.check(
  (select bool_and((public.quote_cart(jsonb_build_array(jsonb_build_object(
      'variant_id', 'b0000000-0000-0000-0000-000000000' || lpad(v::text, 3, '0'), 'qty', 1)), '442001')
      ->> 'total_paise')::int = t * 100)
   from (values (100, 130), (200, 230), (349, 379), (350, 350), (500, 500)) x(v, t)),
  'fee table: 100→130, 200→230, 349→379, 350→350, 500→500');

select pg_temp.check(
  (public.quote_cart('[{"variant_id":"b0000000-0000-0000-0000-000000000100","qty":1}]', '442001') ->> 'cod_available')::boolean,
  'COD available on a ₹100 order');
select pg_temp.check(
  public.quote_cart('[{"variant_id":"b0000000-0000-0000-0000-000000000100","qty":1}]', '411001') ->> 'code' = 'pincode_unavailable',
  'unsupported PIN rejected');
select pg_temp.check(
  public.quote_cart('[{"variant_id":"nope","qty":1}]') ->> 'code' = 'invalid_items', 'garbage cart rejected');
select pg_temp.check(
  public.place_order('d0000000-0000-0000-0000-000000000001', 'Ravi', '9876543210', 'House 12 Main Rd', '442001', 'cod',
    '[{"variant_id":"b0000000-0000-0000-0000-000000000100","qty":1}]', 10000) ->> 'code' = 'price_changed',
  'tampered total (fee dodge) not accepted');
select pg_temp.check(
  (public.place_order('d0000000-0000-0000-0000-000000000002', 'Ravi', '+91 98765 43210', 'House 12 Main Rd', '442001', 'cod',
    '[{"variant_id":"b0000000-0000-0000-0000-000000000100","qty":1}]', 13000) ->> 'ok')::boolean,
  'valid COD order placed');
select pg_temp.check(
  (public.place_order('d0000000-0000-0000-0000-000000000002', 'Ravi', '9876543210', 'House 12 Main Rd', '442001', 'cod',
    '[{"variant_id":"b0000000-0000-0000-0000-000000000100","qty":1}]', 13000) ->> 'duplicate')::boolean,
  'double submit returns the same order');
select pg_temp.check(
  public.place_order('d0000000-0000-0000-0000-000000000003', 'Asha', '9876543211', 'Flat 3 Gandhi Chowk', '442001', 'cod',
    '[{"variant_id":"b0000000-0000-0000-0000-000000000500","qty":2}]', 100000) ->> 'code' = 'items_changed',
  'cannot buy more than stock');
select pg_temp.check(public.search_products('tel') = array['a0000000-0000-0000-0000-000000000001'::uuid], 'search by keyword');
select pg_temp.check(public.search_products('sunflwer') = array['a0000000-0000-0000-0000-000000000001'::uuid], 'search tolerates typo');

do $$ begin
  perform count(*) from public.orders;
  raise exception 'TEST FAILED: anon can read orders';
exception when insufficient_privilege then raise notice 'ok - anon cannot read orders';
end $$;
reset role;

select pg_temp.check((select count(*) = 1 from public.orders), 'exactly one order stored');
select pg_temp.check((select phone = '9876543210' from public.orders), 'phone normalised');
select pg_temp.check((select stock_qty = 9 from public.product_variants where label = 'A'), 'stock reduced');

-- staff -------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.check((select count(*) = 1 from public.orders), 'staff sees today''s order');
select pg_temp.check(
  public.update_order_status((select id from public.orders limit 1), 'delivered') ->> 'code' = 'invalid_transition',
  'cannot skip steps');
select pg_temp.check(
  (public.update_order_status((select id from public.orders limit 1), 'confirmed', null, 25) ->> 'ok')::boolean,
  'staff confirms with ETA');
select pg_temp.check(
  public.update_order_status((select id from public.orders limit 1), 'cancelled', 'x') ->> 'code' = 'invalid_transition',
  'staff cannot cancel');
update public.store_settings set delivery_fee_paise = 0;
reset role;
select pg_temp.check((select delivery_fee_paise = 3000 from public.store_settings), 'staff cannot change settings');

-- owner -------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.check(
  (public.update_order_status((select id from public.orders limit 1), 'cancelled', 'Customer asked') ->> 'ok')::boolean,
  'owner cancels');
reset role;
select pg_temp.check((select stock_qty = 10 from public.product_variants where label = 'A'), 'cancel restores stock');
select pg_temp.check((select count(*) >= 1 from public.audit_log), 'changes are audited');

-- coupons ---------------------------------------------------------------
insert into public.coupons (code, kind, value, min_order_paise, max_discount_paise, per_phone_limit, description)
values ('DIWALI10', 'percent', 10, 20000, 5000, 1, '10% off'), ('SECRET50', 'flat', 5000, 0, null, null, 'hidden');
update public.coupons set show_in_checkout = false where code = 'SECRET50';

set request.jwt.claim.sub = '';
set role anon;
select pg_temp.check(
  (public.quote_cart('[{"variant_id":"b0000000-0000-0000-0000-000000000349","qty":1}]', '442001', 'diwali10') ->> 'total_paise')::int = 34900 - 3490 + 3000,
  'percent coupon: 349 - 34.90 + 30 fee');
select pg_temp.check(
  (public.quote_cart('[{"variant_id":"b0000000-0000-0000-0000-000000000100","qty":1}]', '442001', 'DIWALI10') ->> 'coupon_error') is not null,
  'coupon below its minimum is refused');
select pg_temp.check(
  (public.quote_cart('[{"variant_id":"b0000000-0000-0000-0000-000000000500","qty":1}]', '442001', 'DIWALI10') -> 'coupon' ->> 'discount_paise')::int = 5000,
  'coupon discount capped at max');
select pg_temp.check(
  public.quote_cart('[{"variant_id":"b0000000-0000-0000-0000-000000000100","qty":1}]', '442001', 'NOPE99') ->> 'coupon_error' is not null,
  'unknown coupon refused');
select pg_temp.check((select count(*) = 1 from public.coupons), 'hidden coupons are not listed to customers');
select pg_temp.check(
  public.place_order('d0000000-0000-0000-0000-000000000021', 'Meena', '9123456780', 'Plot 9 Tukum', '442001', 'cod',
    '[{"variant_id":"b0000000-0000-0000-0000-000000000349","qty":1}]', 34410, null, null, null, 'DIWALI10') ->> 'ok' = 'true',
  'order with coupon placed');
select pg_temp.check(
  public.place_order('d0000000-0000-0000-0000-000000000022', 'Meena', '9123456780', 'Plot 9 Tukum', '442001', 'cod',
    '[{"variant_id":"b0000000-0000-0000-0000-000000000349","qty":1}]', 34410, null, null, null, 'DIWALI10') ->> 'code' = 'coupon_invalid',
  'same phone cannot reuse a one-time coupon');
select pg_temp.check(
  public.place_order('d0000000-0000-0000-0000-000000000023', 'Raj', '9123456781', 'Plot 9 Tukum', '442001', 'cod',
    '[{"variant_id":"b0000000-0000-0000-0000-000000000200","qty":1}]', 23000, null, null, null, null, 'not-an-email') ->> 'code' = 'invalid_email',
  'bad email refused');
select pg_temp.check(public.order_for_notify((select public_token from (select null::uuid as public_token) x), 'wrong') is null, 'notify needs the secret');
reset role;
select pg_temp.check((select used_count = 1 from public.coupons where code = 'DIWALI10'), 'coupon use counted');
select pg_temp.check((select discount_paise = 3490 and total_paise = 34410 from public.orders where coupon_code = 'DIWALI10'), 'order stores discount');
select value as sec from private.secrets where name = 'notify' \gset
select public_token as ctok from public.orders where coupon_code = 'DIWALI10' \gset
set role anon;
select pg_temp.check(public.order_for_notify(:'ctok', :'sec') ->> 'phone' = '9123456780', 'notify returns order once with secret');
select pg_temp.check(public.order_for_notify(:'ctok', :'sec') is null, 'notify does not repeat');
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.check((public.update_order_status((select id from public.orders where coupon_code = 'DIWALI10'), 'cancelled', 'test') ->> 'ok')::boolean, 'owner cancels coupon order');
reset role;
select pg_temp.check((select used_count = 0 from public.coupons where code = 'DIWALI10'), 'cancel gives the coupon use back');
