-- Vaishnavi Store setup — part 1 of 15: Extensions, enums, admin users, role helpers
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------- Enums ----------------------------------------------------
do $$ begin
  create type public.staff_role as enum ('owner', 'staff');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.order_status as enum ('new', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.payment_method as enum ('cod', 'upi');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.payment_status as enum ('unpaid', 'awaiting_verification', 'paid');
exception when duplicate_object then null;
end $$;

-- ---------- Common trigger: updated_at -------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Admin users ----------------------------------------------
create table if not exists public.admin_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         public.staff_role not null,
  display_name text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create or replace function public.app_role()
returns public.staff_role
language sql stable security definer set search_path = '' as $$
  select role from public.admin_users
  where user_id = auth.uid() and is_active
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_role() = 'owner', false)
$$;

create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_role() is not null
$$;
