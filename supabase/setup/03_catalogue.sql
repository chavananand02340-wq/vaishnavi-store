-- Vaishnavi Store setup — part 3 of 15: Categories, products, sizes, photos
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- ---------- Catalogue -------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 2 and 60),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
  for each row execute function public.tg_set_updated_at();

create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references public.categories (id) on delete restrict,
  name            text not null check (length(name) between 2 and 120),
  description     text check (length(description) <= 2000),
  search_keywords text check (length(search_keywords) <= 300),  -- e.g. "tel, oil, sunflower"
  is_active       boolean not null default true,
  is_featured     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_search_idx on public.products
  using gin ((name || ' ' || coalesce(search_keywords, '')) extensions.gin_trgm_ops);
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.tg_set_updated_at();

create table if not exists public.product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete cascade,
  label            text not null check (length(label) between 1 and 40),  -- "1 kg", "500 g"
  price_paise      integer not null check (price_paise > 0),
  mrp_paise        integer check (mrp_paise >= price_paise),
  sale_price_paise integer check (sale_price_paise > 0 and sale_price_paise < price_paise),
  sale_ends_at     timestamptz,
  stock_qty        integer not null default 0 check (stock_qty >= 0),
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  sku              text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists product_variants_product_idx on public.product_variants (product_id);
drop trigger if exists product_variants_updated_at on public.product_variants;
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.tg_set_updated_at();

create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id);
