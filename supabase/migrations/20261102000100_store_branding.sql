-- Pending migration: owner confirms NOT applied. Native Storage only; no media decoding.
-- Requires repository predecessors: stores, merchants, is_admin(), store_accepts_new_orders().
-- Fail closed if this schema/buckets already exist; do not overwrite an applied revision.
begin;
create table public.store_branding_assets (
 id uuid primary key,
 store_id uuid not null references public.stores(id) on delete restrict,
 kind text not null check (kind in ('logo','promo_video')),
 storage_path text not null unique,
 mime_type text not null,
 byte_size bigint not null,
 state text not null default 'registered' check (state in ('registered','current','retired')),
 is_current boolean not null default false,
 storage_object_id uuid, storage_updated_at timestamptz,
 created_at timestamptz not null default now(),
 retired_at timestamptz,
 check ((kind='logo' and mime_type in ('image/jpeg','image/png','image/webp') and byte_size between 1 and 4194304)
     or (kind='promo_video' and mime_type='video/mp4' and byte_size between 1 and 52428800)),
 check (storage_path = store_id::text || '/' || kind || '/' || id::text || case mime_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' when 'image/webp' then '.webp' else '.mp4' end),
 check (is_current = (state='current')),
 check (state<>'current' or (storage_object_id is not null and storage_updated_at is not null)),
 check ((state='retired') = (retired_at is not null))
);
create unique index store_branding_one_current on public.store_branding_assets(store_id,kind) where is_current;
create index store_branding_store on public.store_branding_assets(store_id,kind,created_at);
alter table public.store_branding_assets enable row level security;
revoke all on public.store_branding_assets from public,anon,authenticated,service_role;
grant select on public.store_branding_assets to anon,authenticated;
-- All mutation is through narrow RPC. No media processor is involved.
grant select on public.store_branding_assets to service_role;
create function public.branding_owner(target_store uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.stores s join public.merchants m on m.id=s.merchant_id where s.id=target_store and m.owner_user_id=auth.uid());
$$;
-- Published references remain bound to the Storage object identity.
create function public.branding_object_unchanged(asset_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.store_branding_assets a join storage.objects o on o.id=a.storage_object_id and o.bucket_id=case a.kind when 'logo' then 'store-logos' else 'store-videos' end and o.name=a.storage_path and o.updated_at=a.storage_updated_at where a.id=asset_id);
$$;
create function public.branding_can_read(target_store uuid, current_asset boolean) returns boolean language sql stable security definer set search_path='' as $$
 select public.branding_owner(target_store) or public.is_admin() or (current_asset and public.store_accepts_new_orders(target_store));
$$;
create function public.branding_asset_readable(asset_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.store_branding_assets a where a.id=asset_id and public.branding_can_read(a.store_id,a.is_current and public.branding_object_unchanged(a.id)));
$$;
create policy branding_read on public.store_branding_assets for select to anon,authenticated
 using (public.branding_asset_readable(id));
create function public.register_store_branding(asset_id uuid,target_store uuid,asset_kind text,asset_mime text,asset_bytes bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.store_branding_assets; p text;
begin
 if not public.branding_owner(target_store) then raise exception 'not authorized' using errcode='42501'; end if;
 perform 1 from public.stores where id=target_store for update;
 if not public.branding_owner(target_store) then raise exception 'not authorized' using errcode='42501'; end if;
 select * into a from public.store_branding_assets where id=asset_id;
 if found then
  if (a.store_id,a.kind,a.mime_type,a.byte_size) is distinct from (target_store,asset_kind,asset_mime,asset_bytes) then raise exception 'attempt mismatch'; end if;
  return to_jsonb(a);
 end if;
 if (select count(*) from public.store_branding_assets where store_id=target_store and state='registered' and created_at>now()-interval '1 day')>=20 then raise exception 'pending attempt limit'; end if;
 p:=target_store::text||'/'||asset_kind||'/'||asset_id::text||case asset_mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' when 'image/webp' then '.webp' else '.mp4' end;
 insert into public.store_branding_assets(id,store_id,kind,storage_path,mime_type,byte_size) values(asset_id,target_store,asset_kind,p,asset_mime,asset_bytes) returning * into a;
 return to_jsonb(a);
end $$;
create function public.publish_store_branding(asset_id uuid,expected_current uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.store_branding_assets; c uuid; o storage.objects;
begin
 select * into a from public.store_branding_assets where id=asset_id;
 if not found or not public.branding_owner(a.store_id) then raise exception 'not authorized' using errcode='42501'; end if;
 perform 1 from public.stores where id=a.store_id for update;
 if not public.branding_owner(a.store_id) then raise exception 'not authorized' using errcode='42501'; end if;
 select * into a from public.store_branding_assets where id=asset_id for update;
 if not public.store_accepts_new_orders(a.store_id) then raise exception 'store not eligible' using errcode='42501'; end if;
 if a.is_current then
  if not public.branding_object_unchanged(asset_id) then raise exception 'storage object changed'; end if;
  return to_jsonb(a);
 end if;
 if a.state<>'registered' then raise exception 'asset retired'; end if;
 select * into o from storage.objects where bucket_id=case a.kind when 'logo' then 'store-logos' else 'store-videos' end and name=a.storage_path for share;
 if not found then raise exception 'upload not confirmed'; end if;
 -- Storage metadata is its recorded byte count/declared MIME, NOT codec/content verification.
 if (o.metadata->>'size')::bigint is distinct from a.byte_size or o.metadata->>'mimetype' is distinct from a.mime_type then raise exception 'uploaded metadata mismatch'; end if;
 select id into c from public.store_branding_assets where store_id=a.store_id and kind=a.kind and is_current;
 if c is distinct from expected_current then raise exception 'current asset changed' using errcode='40001'; end if;
 update public.store_branding_assets set is_current=false,state='retired',retired_at=now() where id=c;
 update public.store_branding_assets set is_current=true,state='current',storage_object_id=o.id,storage_updated_at=o.updated_at where id=asset_id returning * into a;
 return to_jsonb(a);
end $$;
create function public.unpublish_store_branding(asset_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.store_branding_assets;
begin
 select * into a from public.store_branding_assets where id=asset_id;
 if not found or not public.branding_owner(a.store_id) then raise exception 'not authorized' using errcode='42501'; end if;
 perform 1 from public.stores where id=a.store_id for update;
 if not public.branding_owner(a.store_id) then raise exception 'not authorized' using errcode='42501'; end if;
 update public.store_branding_assets set is_current=false,state='retired',retired_at=now() where id=asset_id and state<>'retired';
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('store-logos','store-logos',false,4194304,array['image/jpeg','image/png','image/webp']),
 ('store-videos','store-videos',false,52428800,array['video/mp4']);
create function public.branding_upload_allowed(target_bucket text,object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.store_branding_assets a where a.storage_path=object_name and a.state='registered' and target_bucket=case a.kind when 'logo' then 'store-logos' else 'store-videos' end and public.branding_owner(a.store_id));
$$;
create function public.branding_read_allowed(target_bucket text,object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.store_branding_assets a where a.storage_path=object_name and target_bucket=case a.kind when 'logo' then 'store-logos' else 'store-videos' end and public.branding_can_read(a.store_id,a.is_current and public.branding_object_unchanged(a.id)));
$$;
-- Restrictive guards prevent unrelated permissive policies from widening this bucket.
create policy branding_insert on storage.objects for insert to authenticated with check(bucket_id in ('store-logos','store-videos') and public.branding_upload_allowed(bucket_id,name));
create policy branding_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id not in ('store-logos','store-videos') or public.branding_upload_allowed(bucket_id,name));
create policy branding_select on storage.objects for select to anon,authenticated using(bucket_id in ('store-logos','store-videos') and public.branding_read_allowed(bucket_id,name));
create policy branding_select_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id not in ('store-logos','store-videos') or public.branding_read_allowed(bucket_id,name));
create policy branding_no_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id not in ('store-logos','store-videos')) with check(bucket_id not in ('store-logos','store-videos'));
create policy branding_no_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id not in ('store-logos','store-videos'));
-- Explicit ACLs; no client writes to the reference table and no verification RPC.
revoke all on function public.branding_asset_readable(uuid),public.branding_object_unchanged(uuid),public.branding_owner(uuid),public.branding_can_read(uuid,boolean),public.branding_upload_allowed(text,text),public.branding_read_allowed(text,text),public.register_store_branding(uuid,uuid,text,text,bigint),public.publish_store_branding(uuid,uuid),public.unpublish_store_branding(uuid) from public,anon,authenticated,service_role;
grant execute on function public.branding_asset_readable(uuid),public.branding_read_allowed(text,text),public.branding_upload_allowed(text,text) to anon,authenticated;
grant execute on function public.register_store_branding(uuid,uuid,text,text,bigint),public.publish_store_branding(uuid,uuid),public.unpublish_store_branding(uuid) to authenticated;
commit;
