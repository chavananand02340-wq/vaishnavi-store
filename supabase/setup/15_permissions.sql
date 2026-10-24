-- Vaishnavi Store setup — part 15 of 15: Table and function permissions (run last)
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- Explicit table privileges. Supabase normally grants these automatically,
-- but newer projects can turn that off, so we state them here. Row Level
-- Security still decides which rows each role can see or change.

grant usage on schema public to anon, authenticated;

-- Public catalogue + settings: customers read, the owner writes (RLS checks owner).
grant select on public.store_settings, public.delivery_pincodes, public.categories,
  public.products, public.product_variants, public.product_images to anon, authenticated;
grant insert, update, delete on public.delivery_pincodes, public.categories,
  public.products, public.product_variants, public.product_images to authenticated;
grant update on public.store_settings to authenticated;

-- Team-only reads. Orders are changed only through functions.
grant select on public.admin_users, public.orders, public.order_items,
  public.order_status_history, public.audit_log to authenticated;
grant insert, update, delete on public.admin_users to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- ---------- Function privileges --------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.store_is_open()                    to anon, authenticated;
grant execute on function public.quote_cart(jsonb, text)            to anon, authenticated;
grant execute on function public.place_order(uuid, text, text, text, text, public.payment_method, jsonb, integer, text, text, text)
                                                                     to anon, authenticated;
grant execute on function public.get_order_by_token(uuid)           to anon, authenticated;

grant execute on function public.app_role()                         to authenticated;
grant execute on function public.is_owner()                         to anon, authenticated;
grant execute on function public.is_team_member()                   to anon, authenticated;
grant execute on function public.staff_can_see(public.order_status, timestamptz) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text, integer) to authenticated;
grant execute on function public.set_payment_status(uuid, public.payment_status) to authenticated;
revoke execute on function public.mark_item_unavailable(uuid, bigint) from public, anon, authenticated;
revoke execute on function public.submit_upi_utr(uuid, text)          from public, anon, authenticated;
revoke execute on function public.search_products(text, integer)      from public, anon, authenticated;
grant execute on function public.mark_item_unavailable(uuid, bigint) to authenticated;
grant execute on function public.submit_upi_utr(uuid, text)          to anon, authenticated;
grant execute on function public.search_products(text, integer)      to anon, authenticated;
