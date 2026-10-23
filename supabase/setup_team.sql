-- Run in Supabase → SQL Editor AFTER creating the two logins under
-- Authentication → Users → "Add user" (email + password, "Auto confirm" on).
-- Replace the emails below with the real ones.

insert into public.admin_users (user_id, role, display_name)
select id, 'owner', 'Owner' from auth.users where email = 'OWNER_EMAIL_HERE'
on conflict (user_id) do update set role = excluded.role, is_active = true;

insert into public.admin_users (user_id, role, display_name)
select id, 'staff', 'Counter' from auth.users where email = 'COUNTER_EMAIL_HERE'
on conflict (user_id) do update set role = excluded.role, is_active = true;

-- Check:
select u.email, a.role, a.is_active
from public.admin_users a join auth.users u on u.id = a.user_id;

-- To block the counter login later (e.g. a worker leaves):
-- update public.admin_users set is_active = false
--   where user_id = (select id from auth.users where email = 'COUNTER_EMAIL_HERE');
