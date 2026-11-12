-- SYS-ADS-01. Administrative promotions are independent of financial records.
create table public.customer_home_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null default '' check (length(title) <= 100),
  body text not null default '' check (length(body) <= 220),
  advertiser text not null default '' check (length(advertiser) <= 100),
  admin_note text not null default '' check (length(admin_note) <= 500),
  target_kind text not null check (target_kind in ('store','product','offer')),
  target_id uuid not null,
  media_kind text not null check (media_kind in ('image','video')),
  media_path text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  is_active boolean not null default false,
  priority integer not null default 0 check (priority between 0 and 999),
  updated_at timestamptz not null default now(),
  check (split_part(media_path,'/',1) = id::text),
  check (media_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|mp4)$'),
  check ((media_kind = 'video') = (right(media_path,4) = '.mp4'))
);

alter table public.customer_home_ads enable row level security;
revoke all on public.customer_home_ads from public, anon, authenticated;
grant select, insert, update, delete on public.customer_home_ads to authenticated;
create policy customer_home_ads_admin on public.customer_home_ads for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('customer-home-ads','customer-home-ads',false,52428800,
  array['image/jpeg','image/png','image/webp','video/mp4']);

create schema customer_ads_private;
revoke all on schema customer_ads_private from public;

create function customer_ads_private.target_available(kind text, target uuid, at_time timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select case kind
    when 'store' then exists (select 1 from public.stores s where s.id=target and s.status='accepted' and public.store_accepts_new_orders(s.id))
    when 'product' then exists (select 1 from public.products p where p.id=target and p.is_available and public.store_accepts_new_orders(p.store_id))
    when 'offer' then exists (
      select 1 from public.store_offers o
      where o.id=target and o.is_active and o.starts_at<=at_time and (o.ends_at is null or o.ends_at>at_time)
        and public.store_accepts_new_orders(o.store_id)
        and exists (select 1 from public.store_offer_products i where i.offer_id=o.id)
        and not exists (select 1 from public.store_offer_products i join public.products p on p.id=i.product_id
          where i.offer_id=o.id and not p.is_available)
    )
    else false end;
$$;

create function customer_ads_private.validate_ad() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from storage.objects o where o.bucket_id='customer-home-ads' and o.name=new.media_path
    and case when new.media_kind='video' then o.metadata->>'mimetype'='video/mp4'
      else o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp') end) then
    raise exception 'advertisement media unavailable' using errcode='22023';
  end if;
  if tg_op = 'INSERT' or (new.target_kind,new.target_id) is distinct from (old.target_kind,old.target_id) then
    if not (case new.target_kind
      when 'store' then exists (select 1 from public.stores where id=new.target_id)
      when 'product' then exists (select 1 from public.products where id=new.target_id)
      when 'offer' then exists (select 1 from public.store_offers where id=new.target_id)
      else false end) then
      raise exception 'advertisement target unavailable' using errcode='22023';
    end if;
  end if;
  if new.is_active and not customer_ads_private.target_available(new.target_kind,new.target_id,greatest(now(),new.starts_at)) then
    raise exception 'advertisement target unavailable' using errcode='22023';
  end if;
  return new;
end;
$$;
create trigger validate_customer_home_ad before insert or update on public.customer_home_ads
for each row execute function customer_ads_private.validate_ad();
create trigger customer_home_ad_updated before update on public.customer_home_ads
for each row execute function public.set_updated_at();

create function public.can_read_customer_ad_media(media_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.customer_home_ads a where a.media_path=media_name
      and a.is_active and a.starts_at<=now() and a.ends_at>now()
      and customer_ads_private.target_available(a.target_kind,a.target_id,now())
  );
$$;
create policy customer_ad_media_read on storage.objects for select to anon,authenticated
  using (bucket_id='customer-home-ads' and public.can_read_customer_ad_media(name));
create policy customer_ad_media_insert on storage.objects for insert to authenticated
  with check (bucket_id='customer-home-ads' and public.is_admin());
create function public.can_delete_customer_ad_media(media_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() and not exists (select 1 from public.customer_home_ads a where a.media_path=media_name);
$$;
create policy customer_ad_media_delete on storage.objects for delete to authenticated
  using (bucket_id='customer-home-ads' and public.can_delete_customer_ad_media(name));

create function public.read_customer_home_ads()
returns table(id uuid,title text,body text,target_kind text,target_id uuid,media_kind text,media_path text,ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id,a.title,a.body,a.target_kind,a.target_id,a.media_kind,a.media_path,a.ends_at
  from public.customer_home_ads a
  join storage.objects o on o.bucket_id='customer-home-ads' and o.name=a.media_path
  where a.is_active and a.starts_at<=now() and a.ends_at>now()
    and customer_ads_private.target_available(a.target_kind,a.target_id,now())
  order by a.priority desc,a.starts_at desc,a.id
  limit 6;
$$;
revoke all on function public.can_read_customer_ad_media(text),public.read_customer_home_ads() from public,anon,authenticated;
grant execute on function public.can_read_customer_ad_media(text),public.read_customer_home_ads() to anon,authenticated;
revoke all on function public.can_delete_customer_ad_media(text) from public,anon,authenticated;
grant execute on function public.can_delete_customer_ad_media(text) to authenticated;
notify pgrst,'reload schema';
