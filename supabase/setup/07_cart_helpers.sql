-- Vaishnavi Store setup — part 7 of 15: Store-open check and cart validation
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- =====================================================================
-- Pricing / checkout functions
-- =====================================================================

-- Is the store open right now (hours + manual switch)?
create or replace function public.store_is_open()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  s public.store_settings;
  t time;
begin
  select * into s from public.store_settings where id = 1;
  if not found or not s.accepting_orders then
    return false;
  end if;
  t := (now() at time zone s.timezone)::time;
  if s.open_time <= s.close_time then
    return t >= s.open_time and t < s.close_time;
  else  -- overnight hours, e.g. 18:00–02:00
    return t >= s.open_time or t < s.close_time;
  end if;
end $$;

-- Cart payload shape check, done before any cast so bad input can't raise errors.
create or replace function public._items_valid(p_items jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p_items is not null
     and jsonb_typeof(p_items) = 'array'
     and jsonb_array_length(p_items) between 1 and 60
     and not exists (
       select 1 from jsonb_array_elements(p_items) e
       where jsonb_typeof(e) <> 'object'
          or coalesce(e ->> 'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or coalesce(e ->> 'qty', '') !~ '^[1-9][0-9]?$'
          or (e ->> 'qty')::integer > 50)
$$;
