-- Vaishnavi Store setup — part 22: Picture for the top offer banner
-- Run in Supabase → SQL Editor, after part 21. Safe to run again.

alter table public.store_settings add column if not exists sale_image_path text;
alter table public.store_settings add column if not exists sale_link_url text;

do $$ begin
  alter table public.store_settings add constraint settings_sale_picture_checks check (
    length(coalesce(sale_image_path, '')) <= 300 and length(coalesce(sale_link_url, '')) <= 300);
exception when duplicate_object then null;
end $$;
