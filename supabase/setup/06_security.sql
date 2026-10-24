-- Vaishnavi Store setup — part 6 of 15: Row Level Security policies
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.admin_users          enable row level security;
alter table public.store_settings       enable row level security;
alter table public.delivery_pincodes    enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.product_variants     enable row level security;
alter table public.product_images       enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.audit_log            enable row level security;

-- admin_users: a member can read their own row; only the owner manages.
drop policy if exists admin_users_select on public.admin_users;
create policy admin_users_select on public.admin_users for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
drop policy if exists admin_users_owner_write on public.admin_users;
create policy admin_users_owner_write on public.admin_users for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- store_settings: public read, owner update. Never insert/delete (single row).
drop policy if exists settings_read on public.store_settings;
create policy settings_read on public.store_settings for select to anon, authenticated using (true);
drop policy if exists settings_owner_update on public.store_settings;
create policy settings_owner_update on public.store_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- delivery_pincodes: public sees active ones; owner manages all.
drop policy if exists pincodes_read on public.delivery_pincodes;
create policy pincodes_read on public.delivery_pincodes for select to anon, authenticated
  using (is_active or public.is_owner());
drop policy if exists pincodes_owner_write on public.delivery_pincodes;
create policy pincodes_owner_write on public.delivery_pincodes for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- catalogue: public sees active rows; owner manages.
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to anon, authenticated
  using (is_active or public.is_owner());
drop policy if exists categories_owner_write on public.categories;
create policy categories_owner_write on public.categories for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists products_read on public.products;
create policy products_read on public.products for select to anon, authenticated
  using (is_active or public.is_owner());
drop policy if exists products_owner_write on public.products;
create policy products_owner_write on public.products for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists variants_read on public.product_variants;
create policy variants_read on public.product_variants for select to anon, authenticated
  using (is_active or public.is_owner());
drop policy if exists variants_owner_write on public.product_variants;
create policy variants_owner_write on public.product_variants for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists images_read on public.product_images;
create policy images_read on public.product_images for select to anon, authenticated using (true);
drop policy if exists images_owner_write on public.product_images;
create policy images_owner_write on public.product_images for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- orders: owner sees all; staff sees active + today's (IST). No direct writes:
-- every change goes through a SECURITY DEFINER function below.
create or replace function public.staff_can_see(p_status public.order_status, p_created timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select p_status in ('new', 'confirmed', 'out_for_delivery')
      or (p_created at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
$$;

drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated
  using (public.is_owner() or (public.is_team_member() and public.staff_can_see(status, created_at)));

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));  -- inherits orders RLS

drop policy if exists order_history_read on public.order_status_history;
create policy order_history_read on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

drop policy if exists audit_owner_read on public.audit_log;
create policy audit_owner_read on public.audit_log for select to authenticated
  using (public.is_owner());

-- Belt and braces: remove direct write privileges on order tables & audit.
revoke insert, update, delete on public.orders, public.order_items,
  public.order_status_history, public.audit_log from anon, authenticated;
revoke all on public.admin_users, public.audit_log, public.orders,
  public.order_items, public.order_status_history from anon;
