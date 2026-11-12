-- Optional JPEG poster for each immutable published video version.
begin;

alter table public.customer_home_ads
  add column thumbnail_path text,
  add constraint customer_home_ad_thumbnail_matches_video check (
    thumbnail_path is null or (media_kind = 'video' and
      thumbnail_path = regexp_replace(media_path, '\.mp4$', '.jpg'))
  );

create function customer_ads_private.validate_ad_thumbnail() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.thumbnail_path is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'customer-home-ads' and o.name = new.thumbnail_path
      and o.metadata->>'mimetype' = 'image/jpeg'
  ) then
    raise exception 'advertisement thumbnail unavailable' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function customer_ads_private.validate_ad_thumbnail() from public, anon, authenticated;
create trigger validate_customer_home_ad_thumbnail
before insert or update of thumbnail_path, media_path, media_kind on public.customer_home_ads
for each row execute function customer_ads_private.validate_ad_thumbnail();

create or replace function public.can_read_customer_ad_media(media_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.customer_home_ads a where (a.media_path=media_name or a.thumbnail_path=media_name)
      and a.is_active and a.starts_at<=now() and a.ends_at>now()
      and customer_ads_private.target_available(a.target_kind,a.target_id,now())
  );
$$;

create or replace function public.can_delete_customer_ad_media(media_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() and not exists (select 1 from public.customer_home_ads a where a.media_path=media_name or a.thumbnail_path=media_name);
$$;

drop function public.read_customer_home_ads();
create function public.read_customer_home_ads()
returns table(id uuid,title text,body text,target_kind text,target_id uuid,media_kind text,media_path text,ends_at timestamptz,thumbnail_path text)
language sql stable security definer set search_path = '' as $$
  select a.id,a.title,a.body,a.target_kind,a.target_id,a.media_kind,a.media_path,a.ends_at,a.thumbnail_path
  from public.customer_home_ads a
  join storage.objects o on o.bucket_id='customer-home-ads' and o.name=a.media_path
  where a.is_active and a.starts_at<=now() and a.ends_at>now()
    and customer_ads_private.target_available(a.target_kind,a.target_id,now())
  order by a.priority desc,a.starts_at desc,a.id
  limit 6;
$$;
revoke all on function public.read_customer_home_ads() from public, anon, authenticated;
grant execute on function public.read_customer_home_ads() to anon, authenticated;
notify pgrst, 'reload schema';

commit;
