-- Vaishnavi Store setup — part 14 of 15: UPI reference and product search
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- Customer adds the UPI transaction reference (UTR) after paying.
create or replace function public.submit_upi_utr(p_token uuid, p_utr text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_utr text := upper(regexp_replace(coalesce(p_utr, ''), '\s', '', 'g'));
  v_order public.orders;
begin
  if v_utr !~ '^[A-Z0-9]{6,30}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_utr', 'message', 'Enter the 12-digit UPI reference number.');
  end if;
  select * into v_order from public.orders where public_token = p_token for update;
  if not found or v_order.payment_method <> 'upi' or v_order.payment_status = 'paid' or v_order.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'not_allowed', 'message', 'This order does not need a UPI reference.');
  end if;
  update public.orders set upi_utr = v_utr, payment_status = 'awaiting_verification' where id = v_order.id;
  return jsonb_build_object('ok', true);
end $$;

-- Product search: name/keywords match, best matches first. Returns product ids.
create or replace function public.search_products(p_q text, p_limit integer default 40)
returns uuid[] language sql stable security definer set search_path = '' as $$
  with q as (select replace(replace(lower(left(trim(coalesce(p_q, '')), 60)), '%', ''), '_', '') as t)
  select coalesce(array_agg(id order by rank desc, name), '{}')
  from (
    select p.id, p.name,
           case when lower(p.name) like (select t from q) || '%' then 3
                when lower(p.name) like '%' || (select t from q) || '%' then 2
                when lower(coalesce(p.search_keywords, '')) like '%' || (select t from q) || '%' then 1.5
                else extensions.word_similarity((select t from q), lower(p.name || ' ' || coalesce(p.search_keywords, ''))) end as rank
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.is_active and c.is_active
      and length((select t from q)) >= 2
      and (
        lower(p.name || ' ' || coalesce(p.search_keywords, '')) like '%' || (select t from q) || '%'
        or extensions.word_similarity((select t from q), lower(p.name || ' ' || coalesce(p.search_keywords, ''))) >= 0.45
      )
    order by rank desc, p.name
    limit greatest(1, least(coalesce(p_limit, 40), 100))
  ) r
$$;
