-- Product image bucket: public read, owner-only write, images only, max 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "product images owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_owner());
create policy "product images owner update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_owner())
  with check (bucket_id = 'product-images' and public.is_owner());
create policy "product images owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_owner());

-- Live new-order alerts for the owner/staff panels. Realtime respects RLS,
-- so staff only receive orders they are allowed to see.
alter publication supabase_realtime add table public.orders;
