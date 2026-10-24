-- Vaishnavi Store setup — part 16: Home-page banners + Marathi/Hindi product names
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- Optional second name shown under the product name (e.g. "गव्हाचे पीठ").
alter table public.products add column if not exists name_local text;
do $$ begin
  alter table public.products add constraint products_name_local_len check (length(name_local) <= 120);
exception when duplicate_object then null;
end $$;

-- Banners the owner uploads for the home-page slider.
create table if not exists public.banners (
  id         uuid primary key default gen_random_uuid(),
  image_path text not null,
  link_url   text check (length(link_url) <= 300),
  alt_text   text check (length(alt_text) <= 160),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.banners enable row level security;

drop policy if exists banners_read on public.banners;
create policy banners_read on public.banners for select to anon, authenticated
  using (is_active or public.is_owner());
drop policy if exists banners_owner_write on public.banners;
create policy banners_owner_write on public.banners for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;

-- Search also matches the Marathi/Hindi name.
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
                else extensions.word_similarity((select t from q), lower(p.name || ' ' || coalesce(p.name_local, '') || ' ' || coalesce(p.search_keywords, ''))) end as rank
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.is_active and c.is_active
      and length((select t from q)) >= 2
      and (
        lower(p.name || ' ' || coalesce(p.name_local, '') || ' ' || coalesce(p.search_keywords, '')) like '%' || (select t from q) || '%'
        or extensions.word_similarity((select t from q), lower(p.name || ' ' || coalesce(p.name_local, '') || ' ' || coalesce(p.search_keywords, ''))) >= 0.45
      )
    order by rank desc, p.name
    limit greatest(1, least(coalesce(p_limit, 40), 100))
  ) r
$$;
