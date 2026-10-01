-- Evaluate storage ownership through a narrowly scoped SECURITY DEFINER helper.
-- This avoids nested RLS visibility issues while still limiting every path to
-- the authenticated owner of the store id in its first folder segment.
create or replace function public.can_manage_store_media_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores s
    join public.merchants m on m.id = s.merchant_id
    where s.id::text = (storage.foldername(object_name))[1]
      and m.owner_user_id = auth.uid()
  );
$$;

revoke all on function public.can_manage_store_media_path(text) from public, anon;
grant execute on function public.can_manage_store_media_path(text) to authenticated;

drop policy if exists store_media_insert_owner on storage.objects;
create policy store_media_insert_owner on storage.objects
for insert to authenticated
with check (bucket_id = 'store-media' and public.can_manage_store_media_path(name));

drop policy if exists store_media_update_owner on storage.objects;
create policy store_media_update_owner on storage.objects
for update to authenticated
using (bucket_id = 'store-media' and public.can_manage_store_media_path(name))
with check (bucket_id = 'store-media' and public.can_manage_store_media_path(name));

drop policy if exists store_media_delete_owner on storage.objects;
create policy store_media_delete_owner on storage.objects
for delete to authenticated
using (bucket_id = 'store-media' and public.can_manage_store_media_path(name));

drop policy if exists store_media_select_owner on storage.objects;
create policy store_media_select_owner on storage.objects
for select to authenticated
using (bucket_id = 'store-media' and public.can_manage_store_media_path(name));
