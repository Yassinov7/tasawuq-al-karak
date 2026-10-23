-- Public review projections must use caller RLS and column privileges.
-- Requires the ratings schema and Migration 004 catalog/grace policies (PG 15+).
begin;

-- Anonymous catalog reads must not evaluate owner subqueries on merchants,
-- a private relation on which anon intentionally has no SELECT grant.
-- Authenticated owner/admin behavior stays in the existing policies.
alter policy stores_read_accepted_public on public.stores to authenticated;
alter policy stores_subscription_grace_read_gate on public.stores to authenticated;
alter policy products_read_available_owner_admin on public.products to authenticated;
alter policy products_subscription_grace_read_gate on public.products to authenticated;

create policy stores_public_anon_read on public.stores for select to anon
  using (public.store_accepts_new_orders(id));
create policy stores_public_anon_gate on public.stores as restrictive for select to anon
  using (public.store_accepts_new_orders(id));
create policy products_public_anon_read on public.products for select to anon
  using (is_available and public.store_accepts_new_orders(store_id));
create policy products_public_anon_gate on public.products as restrictive for select to anon
  using (is_available and public.store_accepts_new_orders(store_id));

alter table public.store_reviews enable row level security;
alter table public.product_reviews enable row level security;

-- No moderation/draft flag exists: accepted reviews are public only while
-- their store/catalog is publicly eligible, including subscription grace.
create policy store_reviews_public_read on public.store_reviews for select to anon, authenticated
  using (public.store_accepts_new_orders(store_id));
create policy product_reviews_public_read on public.product_reviews for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_reviews.product_id and p.store_id = product_reviews.store_id
      and p.is_available and public.store_accepts_new_orders(p.store_id)
  ));

-- Preserve mutation RPCs; never grant direct review INSERT/UPDATE/DELETE.
-- Clear both table-wide and any explicit column SELECT grants before allowlisting.
revoke all on public.store_reviews, public.product_reviews from public, anon, authenticated;
revoke select (id, store_order_id, store_id, customer_id, rating, comment, created_at, updated_at)
  on public.store_reviews from public, anon, authenticated;
revoke select (id, store_order_id, store_id, purchased_product_id, product_id,
  product_title_snapshot, customer_id, rating, comment, created_at, updated_at)
  on public.product_reviews from public, anon, authenticated;
grant select (id, store_id, rating, comment, created_at, updated_at)
  on public.store_reviews to anon, authenticated;
grant select (id, product_id, product_title_snapshot, rating, comment, created_at, updated_at)
  on public.product_reviews to anon, authenticated;

alter view public.product_public_reviews set (security_invoker = true, security_barrier = true);
alter view public.product_rating_summaries set (security_invoker = true, security_barrier = true);
alter view public.store_public_reviews set (security_invoker = true, security_barrier = true);
alter view public.store_rating_summaries set (security_invoker = true, security_barrier = true);
revoke all on public.product_public_reviews, public.product_rating_summaries,
  public.store_public_reviews, public.store_rating_summaries from public, anon, authenticated;
grant select on public.product_public_reviews, public.product_rating_summaries,
  public.store_public_reviews, public.store_rating_summaries to anon, authenticated;
commit;
