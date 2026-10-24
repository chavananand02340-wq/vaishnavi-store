-- Vaishnavi Store setup — part 5 of 15: Audit log of settings/price changes
-- Run in Supabase → SQL Editor. Safe to run again if it fails halfway.

-- ---------- Audit log (owner-visible) --------------------------------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_id text;
begin
  v_id := coalesce(
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'id',
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'pincode'
  );
  insert into public.audit_log (actor, action, entity, entity_id, details)
  values (
    auth.uid(), lower(tg_op), tg_table_name, v_id,
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
      'new', case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end
    )
  );
  return null;
end $$;

drop trigger if exists audit_store_settings on public.store_settings;
create trigger audit_store_settings after update on public.store_settings
  for each row execute function public.tg_audit();
drop trigger if exists audit_delivery_pincodes on public.delivery_pincodes;
create trigger audit_delivery_pincodes after insert or update or delete on public.delivery_pincodes
  for each row execute function public.tg_audit();
drop trigger if exists audit_variant_price on public.product_variants;
create trigger audit_variant_price after update of price_paise, sale_price_paise, mrp_paise on public.product_variants
  for each row execute function public.tg_audit();
