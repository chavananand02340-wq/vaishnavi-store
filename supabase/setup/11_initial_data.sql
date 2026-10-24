-- Vaishnavi Store setup — part 11 of 15: Store details and PIN 442001
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- =====================================================================
-- Initial data (confirmed in the brief)
-- =====================================================================
insert into public.store_settings (id, store_name, phone_primary, phone_secondary, instagram_url, maps_url)
values (1, 'Vaishnavi Store', '9890550785', '8482891640',
        'https://www.instagram.com/vaish.navi_store/', 'https://maps.app.goo.gl/CEXEdHUxKe8hmWmk7')
on conflict (id) do nothing;

insert into public.delivery_pincodes (pincode, is_active) values ('442001', true)
on conflict (pincode) do nothing;
