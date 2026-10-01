-- Merchant store profile, categorized catalog, media, and flexible store offers.


create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.product_categories(name, slug, sort_order) values
  ('مواد غذائية', 'groceries', 10),
  ('خضار وفواكه', 'produce', 20),
  ('ألبان وأجبان', 'dairy', 30),
  ('لحوم ودواجن', 'meat-poultry', 40),
  ('مخبوزات', 'bakery', 50),
  ('مشروبات', 'drinks', 60),
  ('منزل ومطبخ', 'home-kitchen', 70),
  ('عناية شخصية', 'personal-care', 80),
  ('أخرى', 'other', 90);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 2 and 140),
  description text not null default '' check (char_length(description) <= 5000),
  price numeric(14,2) not null check (price > 0),
  currency public.currency_code not null default 'SYP',
  selling_unit text not null default 'قطعة' check (char_length(trim(selling_unit)) between 1 and 32),
  minimum_quantity numeric(12,3) not null default 1 check (minimum_quantity > 0),
  quantity_step numeric(12,3) not null default 1 check (quantity_step > 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id)
);
create index products_store_available_idx on public.products(store_id, is_available, created_at desc);
create index products_category_idx on public.products(category_id, is_available);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  product_id uuid not null,
  media_type public.store_media_type not null,
  storage_path text not null unique,
  display_order integer not null default 0,
  alt_text text not null default '' check (char_length(alt_text) <= 180),
  created_at timestamptz not null default now(),
  foreign key (product_id, store_id) references public.products(id, store_id) on delete cascade
);
create index product_media_order_idx on public.product_media(product_id, display_order);
create unique index product_media_single_video_idx on public.product_media(product_id) where media_type = 'video';

create table public.store_offers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 140),
  description text not null default '' check (char_length(description) <= 5000),
  offer_type public.store_offer_type not null,
  discount_method public.offer_discount_method,
  discount_value numeric(14,2),
  bundle_price numeric(14,2),
  currency public.currency_code not null default 'SYP',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id),
  check (ends_at is null or ends_at > starts_at),
  check (
    (offer_type = 'discount' and discount_method is not null and discount_value > 0
      and (discount_method <> 'percentage' or discount_value <= 100) and bundle_price is null)
    or (offer_type = 'bundle' and bundle_price > 0 and discount_value is null and discount_method is null)
    or (offer_type = 'buy_x_get_y' and discount_value is null and discount_method is null and bundle_price is null)
  )
);
create index store_offers_active_idx on public.store_offers(store_id, is_active, starts_at, ends_at);
create trigger store_offers_updated_at before update on public.store_offers
  for each row execute function public.set_updated_at();

create table public.store_offer_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  offer_id uuid not null,
  product_id uuid not null,
  item_role public.offer_product_role not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unique (offer_id, product_id, item_role),
  foreign key (offer_id, store_id) references public.store_offers(id, store_id) on delete cascade,
  foreign key (product_id, store_id) references public.products(id, store_id) on delete restrict
);
create index store_offer_products_product_idx on public.store_offer_products(product_id);

create table public.store_offer_media (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  offer_id uuid not null,
  media_type public.store_media_type not null,
  storage_path text not null unique,
  display_order integer not null default 0,
  alt_text text not null default '' check (char_length(alt_text) <= 180),
  created_at timestamptz not null default now(),
  foreign key (offer_id, store_id) references public.store_offers(id, store_id) on delete cascade
);
create index store_offer_media_order_idx on public.store_offer_media(offer_id, display_order);
create unique index store_offer_media_single_video_idx on public.store_offer_media(offer_id) where media_type = 'video';

create or replace function public.enforce_store_media_limits()
returns trigger language plpgsql set search_path = '' as $$
declare
  image_count integer;
  video_count integer;
begin
  if tg_table_name = 'product_media' then
    perform 1 from public.products p where p.id = new.product_id for update;
    select count(*) filter (where pm.media_type = 'image'), count(*) filter (where pm.media_type = 'video')
      into image_count, video_count from public.product_media pm
      where pm.product_id = new.product_id and pm.id is distinct from new.id;
  else
    perform 1 from public.store_offers o where o.id = new.offer_id for update;
    select count(*) filter (where om.media_type = 'image'), count(*) filter (where om.media_type = 'video')
      into image_count, video_count from public.store_offer_media om
      where om.offer_id = new.offer_id and om.id is distinct from new.id;
  end if;
  if new.media_type = 'image' and image_count >= 5 then raise exception 'a product or offer can have at most five images'; end if;
  if new.media_type = 'video' and video_count >= 1 then raise exception 'a product or offer can have at most one video'; end if;
  return new;
end;
$$;
create trigger product_media_limit before insert or update on public.product_media
  for each row execute function public.enforce_store_media_limits();
create trigger store_offer_media_limit before insert or update on public.store_offer_media
  for each row execute function public.enforce_store_media_limits();

create or replace function public.save_store_offer(
  selected_offer uuid,
  input_title text,
  input_description text,
  input_type public.store_offer_type,
  input_discount_method public.offer_discount_method,
  input_discount_value numeric,
  input_bundle_price numeric,
  input_currency public.currency_code,
  input_ends_at timestamptz,
  input_is_active boolean,
  input_items jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  owner_store uuid;
  saved_offer uuid;
  item jsonb;
  item_role_value public.offer_product_role;
  product_id_value uuid;
  quantity_value numeric;
  product_price numeric;
  product_currency public.currency_code;
  bundle_total numeric := 0;
  buy_count integer := 0;
  reward_count integer := 0;
  item_count integer := 0;
begin
  select s.id into owner_store from public.stores s
    join public.merchants m on m.id = s.merchant_id
    where m.owner_user_id = auth.uid() and s.status = 'accepted' and m.status = 'accepted';
  if owner_store is null then raise exception 'approved merchant store required'; end if;
  if nullif(trim(input_title), '') is null or char_length(trim(input_title)) > 140
     or char_length(coalesce(input_description, '')) > 5000
     or (input_ends_at is not null and input_ends_at <= now()) then
    raise exception 'offer details are invalid';
  end if;
  if input_items is null or jsonb_typeof(input_items) is distinct from 'array' or jsonb_array_length(input_items) = 0 then
    raise exception 'at least one product must be assigned to the offer';
  end if;
  if input_type = 'discount' and (input_discount_method is null or input_discount_value is null or input_discount_value <= 0
      or (input_discount_method = 'percentage' and input_discount_value > 100)) then
    raise exception 'discount amount is invalid';
  end if;
  if input_type = 'bundle' and (input_bundle_price is null or input_bundle_price <= 0) then
    raise exception 'bundle price is invalid';
  end if;

  if selected_offer is null then
    insert into public.store_offers(store_id, title, description, offer_type, discount_method, discount_value,
      bundle_price, currency, ends_at, is_active)
    values (owner_store, trim(input_title), coalesce(trim(input_description), ''), input_type,
      case when input_type = 'discount' then input_discount_method else null end,
      case when input_type = 'discount' then input_discount_value else null end,
      case when input_type = 'bundle' then input_bundle_price else null end,
      input_currency, input_ends_at, coalesce(input_is_active, true))
    returning id into saved_offer;
  else
    update public.store_offers set title = trim(input_title), description = coalesce(trim(input_description), ''),
      offer_type = input_type, discount_method = case when input_type = 'discount' then input_discount_method else null end,
      discount_value = case when input_type = 'discount' then input_discount_value else null end,
      bundle_price = case when input_type = 'bundle' then input_bundle_price else null end,
      currency = input_currency, ends_at = input_ends_at, is_active = coalesce(input_is_active, true)
      where id = selected_offer and store_id = owner_store returning id into saved_offer;
    if saved_offer is null then raise exception 'offer not found'; end if;
    delete from public.store_offer_products where offer_id = saved_offer;
  end if;

  for item in select value from jsonb_array_elements(input_items)
  loop
    item_count := item_count + 1;
    product_id_value := nullif(item ->> 'product_id', '')::uuid;
    item_role_value := (item ->> 'item_role')::public.offer_product_role;
    quantity_value := (item ->> 'quantity')::numeric;
    if quantity_value is null or quantity_value <= 0 or product_id_value is null then
      raise exception 'offer product selection is invalid';
    end if;
    if (input_type = 'discount' and item_role_value <> 'discounted')
       or (input_type = 'bundle' and item_role_value <> 'bundle')
       or (input_type = 'buy_x_get_y' and item_role_value not in ('buy', 'reward')) then
      raise exception 'offer product role does not match offer type';
    end if;
    select p.price, p.currency into product_price, product_currency from public.products p
      where p.id = product_id_value and p.store_id = owner_store and p.is_available;
    if not found then
      raise exception 'offer products must belong to your store';
    end if;
    if input_type = 'discount' and input_discount_method = 'fixed_amount' then
      if product_currency <> input_currency or input_discount_value >= product_price then
        raise exception 'fixed discount must use the product currency and be less than its price';
      end if;
    end if;
    if input_type = 'bundle' then
      if product_currency <> input_currency then raise exception 'bundle currency must match all selected products'; end if;
      bundle_total := bundle_total + product_price * quantity_value;
    end if;
    if item_role_value = 'buy' then buy_count := buy_count + 1; end if;
    if item_role_value = 'reward' then reward_count := reward_count + 1; end if;
    insert into public.store_offer_products(store_id, offer_id, product_id, item_role, quantity)
      values (owner_store, saved_offer, product_id_value, item_role_value, quantity_value);
  end loop;
  if input_type = 'buy_x_get_y' and (buy_count <> 1 or reward_count <> 1 or item_count <> 2) then
    raise exception 'buy X get Y offers require exactly one buy product and one reward product';
  end if;
  if input_type = 'bundle' and input_bundle_price >= bundle_total then
    raise exception 'bundle price must be less than the selected products total';
  end if;
  return saved_offer;
end;
$$;

create or replace function public.delete_store_offer(target_offer uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.store_offers o using public.stores s, public.merchants m
    where o.id = target_offer and o.store_id = s.id and s.merchant_id = m.id
      and m.owner_user_id = auth.uid();
  if not found then raise exception 'offer not found'; end if;
end;
$$;

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_media enable row level security;
alter table public.store_offers enable row level security;
alter table public.store_offer_products enable row level security;
alter table public.store_offer_media enable row level security;

create policy categories_read_active_admin on public.product_categories for select to anon, authenticated
  using (is_active or public.is_admin());
create policy categories_admin_manage on public.product_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy products_read_available_owner_admin on public.products for select to anon, authenticated
  using (is_available or public.is_admin() or exists (
    select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
    where s.id = store_id and m.owner_user_id = auth.uid()
  ));
create policy products_owner_manage on public.products for all to authenticated
  using (exists (select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
    where s.id = store_id and m.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
    where s.id = store_id and m.owner_user_id = auth.uid()));
create policy product_media_owner_manage on public.product_media for all to authenticated
  using (public.is_admin() or exists (select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
    where s.id = store_id and m.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
    where s.id = store_id and m.owner_user_id = auth.uid()));
create policy product_media_read_public_owner on public.product_media for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_available)
    or public.is_admin() or exists (select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
      where s.id = store_id and m.owner_user_id = auth.uid()));
create policy offers_read_active_owner_admin on public.store_offers for select to anon, authenticated
  using ((is_active and starts_at <= now() and (ends_at is null or ends_at > now()))
    or public.is_admin() or exists (select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
      where s.id = store_id and m.owner_user_id = auth.uid()));
create policy offer_products_read_public_owner on public.store_offer_products for select to anon, authenticated
  using (exists (select 1 from public.store_offers o where o.id = offer_id and o.is_active
    and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now()))
    or public.is_admin() or exists (select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
      where s.id = store_id and m.owner_user_id = auth.uid()));
create policy offer_media_read_public_owner on public.store_offer_media for select to anon, authenticated
  using (exists (select 1 from public.store_offers o where o.id = offer_id and o.is_active
    and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now()))
    or public.is_admin() or exists (select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
      where s.id = store_id and m.owner_user_id = auth.uid()));

grant select on public.product_categories to anon, authenticated;
grant insert, update, delete on public.product_categories to authenticated;
grant select, insert, update, delete on public.products, public.product_media to authenticated;
grant select on public.products, public.product_media to anon;
grant select on public.store_offers, public.store_offer_products, public.store_offer_media to anon, authenticated;
revoke insert, update, delete on public.store_offers, public.store_offer_products, public.store_offer_media from anon, authenticated;

revoke all on function public.save_store_offer(uuid,text,text,public.store_offer_type,public.offer_discount_method,numeric,numeric,public.currency_code,timestamptz,boolean,jsonb) from public, anon;
grant execute on function public.save_store_offer(uuid,text,text,public.store_offer_type,public.offer_discount_method,numeric,numeric,public.currency_code,timestamptz,boolean,jsonb) to authenticated;
revoke all on function public.delete_store_offer(uuid) from public, anon;
grant execute on function public.delete_store_offer(uuid) to authenticated;

create policy stores_owner_update on public.stores for update to authenticated
  using (exists (select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.merchants m where m.id = merchant_id and m.owner_user_id = auth.uid()));
grant update(name, description, phone, address) on public.stores to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy store_media_insert_owner on storage.objects for insert to authenticated
  with check (bucket_id = 'store-media' and exists (
    select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
    where s.id::text = (storage.foldername(name))[1] and m.owner_user_id = auth.uid()
  ));
create policy store_media_update_owner on storage.objects for update to authenticated
  using (bucket_id = 'store-media' and exists (
    select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
    where s.id::text = (storage.foldername(name))[1] and m.owner_user_id = auth.uid()
  )) with check (bucket_id = 'store-media' and exists (
    select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
    where s.id::text = (storage.foldername(name))[1] and m.owner_user_id = auth.uid()
  ));
create policy store_media_delete_owner on storage.objects for delete to authenticated
  using (bucket_id = 'store-media' and exists (
    select 1 from public.stores s join public.merchants m on m.id = s.merchant_id
    where s.id::text = (storage.foldername(name))[1] and m.owner_user_id = auth.uid()
  ));

create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.write_audit_log();
create trigger audit_store_offers after insert or update or delete on public.store_offers
  for each row execute function public.write_audit_log();
create trigger audit_store_offer_products after insert or update or delete on public.store_offer_products
  for each row execute function public.write_audit_log();
create trigger audit_product_media after insert or update or delete on public.product_media
  for each row execute function public.write_audit_log();
create trigger audit_store_offer_media after insert or update or delete on public.store_offer_media
  for each row execute function public.write_audit_log();
create trigger audit_product_categories after insert or update or delete on public.product_categories
  for each row execute function public.write_audit_log();
