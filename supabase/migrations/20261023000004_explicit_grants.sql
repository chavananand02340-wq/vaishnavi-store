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
