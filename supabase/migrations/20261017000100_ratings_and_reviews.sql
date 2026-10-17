-- Customer ratings are created only from delivered store orders. Client roles
-- have no direct access to the base tables; narrowly-scoped RPCs own mutation.

create table public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null unique references public.store_orders(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(trim(comment)) between 1 and 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index store_reviews_store_recent_idx on public.store_reviews(store_id, created_at desc);
create index store_reviews_customer_recent_idx on public.store_reviews(customer_id, created_at desc);
create trigger store_reviews_updated_at before update on public.store_reviews
  for each row execute function public.set_updated_at();

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null references public.store_orders(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  purchased_product_id uuid not null,
  product_id uuid references public.products(id) on delete set null,
  product_title_snapshot text not null,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(trim(comment)) between 1 and 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_order_id, purchased_product_id)
);
create index product_reviews_product_recent_idx
  on public.product_reviews(product_id, created_at desc) where product_id is not null;
create index product_reviews_customer_recent_idx on public.product_reviews(customer_id, created_at desc);
create trigger product_reviews_updated_at before update on public.product_reviews
  for each row execute function public.set_updated_at();

alter table public.store_reviews enable row level security;
alter table public.product_reviews enable row level security;

-- Direct client access is denied. Reads happen through curated public views;
-- writes are limited to the RPCs below.
create policy store_reviews_no_direct_client_access on public.store_reviews
  for all to authenticated using (false) with check (false);
create policy product_reviews_no_direct_client_access on public.product_reviews
  for all to authenticated using (false) with check (false);
revoke all on table public.store_reviews, public.product_reviews from anon, authenticated;

create or replace function public.require_review_customer()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  current_customer uuid := auth.uid();
begin
  if current_customer is null or not exists (
    select 1 from public.profiles p
    where p.id = current_customer and p.role = 'customer'
  ) then
    raise exception 'Customer authentication is required';
  end if;
  return current_customer;
end;
$$;

create or replace function public.create_store_review(
  target_store_order uuid,
  input_rating smallint,
  input_comment text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_customer uuid := public.require_review_customer();
  review_id uuid;
  cleaned_comment text := nullif(trim(coalesce(input_comment, '')), '');
begin
  if input_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;
  if cleaned_comment is not null and char_length(cleaned_comment) > 1500 then
    raise exception 'Review comment is too long';
  end if;

  insert into public.store_reviews (store_order_id, store_id, customer_id, rating, comment)
  select so.id, so.store_id, co.customer_id, input_rating, cleaned_comment
  from public.store_orders so
  join public.customer_orders co on co.id = so.customer_order_id
  where so.id = target_store_order
    and co.customer_id = current_customer
    and so.status = 'delivered'
  returning id into review_id;

  if review_id is null then
    raise exception 'Delivered order is not eligible for a store review';
  end if;
  return review_id;
end;
$$;

create or replace function public.create_product_review(
  target_store_order uuid,
  target_product uuid,
  input_rating smallint,
  input_comment text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_customer uuid := public.require_review_customer();
  review_id uuid;
  cleaned_comment text := nullif(trim(coalesce(input_comment, '')), '');
begin
  if input_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;
  if cleaned_comment is not null and char_length(cleaned_comment) > 1500 then
    raise exception 'Review comment is too long';
  end if;

  insert into public.product_reviews (
    store_order_id, store_id, purchased_product_id, product_id,
    product_title_snapshot, customer_id, rating, comment
  )
  select so.id, so.store_id, soi.product_id, soi.product_id,
    soi.product_title_snapshot, co.customer_id, input_rating, cleaned_comment
  from public.store_orders so
  join public.customer_orders co on co.id = so.customer_order_id
  join public.store_order_items soi on soi.store_order_id = so.id
  join public.products p on p.id = soi.product_id and p.store_id = so.store_id
  where so.id = target_store_order
    and soi.product_id = target_product
    and co.customer_id = current_customer
    and so.status = 'delivered'
  limit 1
  returning id into review_id;

  if review_id is null then
    raise exception 'Delivered order item is not eligible for a product review';
  end if;
  return review_id;
end;
$$;

create or replace function public.update_store_review(
  target_review uuid,
  input_rating smallint,
  input_comment text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_customer uuid := public.require_review_customer();
  cleaned_comment text := nullif(trim(coalesce(input_comment, '')), '');
begin
  if input_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if cleaned_comment is not null and char_length(cleaned_comment) > 1500 then raise exception 'Review comment is too long'; end if;
  update public.store_reviews set rating = input_rating, comment = cleaned_comment
  where id = target_review and customer_id = current_customer;
  if not found then raise exception 'Review was not found'; end if;
end;
$$;

create or replace function public.update_product_review(
  target_review uuid,
  input_rating smallint,
  input_comment text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_customer uuid := public.require_review_customer();
  cleaned_comment text := nullif(trim(coalesce(input_comment, '')), '');
begin
  if input_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if cleaned_comment is not null and char_length(cleaned_comment) > 1500 then raise exception 'Review comment is too long'; end if;
  update public.product_reviews set rating = input_rating, comment = cleaned_comment
  where id = target_review and customer_id = current_customer;
  if not found then raise exception 'Review was not found'; end if;
end;
$$;

create or replace function public.delete_store_review(target_review uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare current_customer uuid := public.require_review_customer();
begin
  delete from public.store_reviews where id = target_review and customer_id = current_customer;
  if not found then raise exception 'Review was not found'; end if;
end;
$$;

create or replace function public.delete_product_review(target_review uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare current_customer uuid := public.require_review_customer();
begin
  delete from public.product_reviews where id = target_review and customer_id = current_customer;
  if not found then raise exception 'Review was not found'; end if;
end;
$$;

-- Direct reads of review tables remain denied. These self-scoped readers give a
-- customer just enough information to edit a review they already own.
create or replace function public.get_my_store_review(target_store_order uuid)
returns table (id uuid, rating smallint, comment text)
language sql stable security definer set search_path = '' as $$
  select sr.id, sr.rating, sr.comment
  from public.store_reviews sr
  where sr.store_order_id = target_store_order
    and sr.customer_id = public.require_review_customer();
$$;

create or replace function public.get_my_product_review(
  target_store_order uuid,
  target_product uuid
)
returns table (id uuid, rating smallint, comment text)
language sql stable security definer set search_path = '' as $$
  select pr.id, pr.rating, pr.comment
  from public.product_reviews pr
  where pr.store_order_id = target_store_order
    and pr.purchased_product_id = target_product
    and pr.customer_id = public.require_review_customer();
$$;

-- Views expose no reviewer, order, contact, or other customer identifiers.
create view public.store_rating_summaries with (security_barrier = true) as
  select s.id as store_id, avg(sr.rating)::numeric(3,2) as average_rating,
    count(sr.id)::bigint as rating_count
  from public.stores s
  left join public.store_reviews sr on sr.store_id = s.id
  where s.status = 'accepted'
  group by s.id;

create view public.product_rating_summaries with (security_barrier = true) as
  select p.id as product_id, avg(pr.rating)::numeric(3,2) as average_rating,
    count(pr.id)::bigint as rating_count
  from public.products p
  join public.stores s on s.id = p.store_id and s.status = 'accepted'
  left join public.product_reviews pr on pr.product_id = p.id
  where p.is_available
  group by p.id;

create view public.store_public_reviews with (security_barrier = true) as
  select sr.id, sr.store_id, sr.rating, sr.comment, sr.created_at, sr.updated_at
  from public.store_reviews sr
  join public.stores s on s.id = sr.store_id and s.status = 'accepted';

create view public.product_public_reviews with (security_barrier = true) as
  select pr.id, pr.product_id, pr.product_title_snapshot, pr.rating, pr.comment,
    pr.created_at, pr.updated_at
  from public.product_reviews pr
  join public.products p on p.id = pr.product_id and p.is_available
  join public.stores s on s.id = p.store_id and s.status = 'accepted';

grant select on public.store_rating_summaries, public.product_rating_summaries,
  public.store_public_reviews, public.product_public_reviews to anon, authenticated;

revoke all on function public.require_review_customer() from public, anon, authenticated;
revoke all on function public.create_store_review(uuid, smallint, text) from public, anon;
revoke all on function public.create_product_review(uuid, uuid, smallint, text) from public, anon;
revoke all on function public.update_store_review(uuid, smallint, text) from public, anon;
revoke all on function public.update_product_review(uuid, smallint, text) from public, anon;
revoke all on function public.delete_store_review(uuid) from public, anon;
revoke all on function public.delete_product_review(uuid) from public, anon;
revoke all on function public.get_my_store_review(uuid) from public, anon;
revoke all on function public.get_my_product_review(uuid, uuid) from public, anon;
grant execute on function public.create_store_review(uuid, smallint, text),
  public.create_product_review(uuid, uuid, smallint, text),
  public.update_store_review(uuid, smallint, text),
  public.update_product_review(uuid, smallint, text),
  public.delete_store_review(uuid), public.delete_product_review(uuid),
  public.get_my_store_review(uuid), public.get_my_product_review(uuid, uuid) to authenticated;
