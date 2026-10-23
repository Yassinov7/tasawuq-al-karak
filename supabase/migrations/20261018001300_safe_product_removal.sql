-- Reuse products.is_available. Never rewrite order/offer/review snapshots.
begin;

-- Application roles must deactivate, not physically delete products. Existing
-- owner UPDATE policies still decide who may change availability; no new bypass.
revoke delete on public.products from public, anon, authenticated;

-- Also protect referenced products against a privileged physical delete or a
-- parent-store cascade. Unreferenced maintenance deletes remain possible for
-- privileged database operators, outside the application removal flow.
create function public.protect_referenced_product_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.store_order_items i where i.product_id = old.id)
    or exists (select 1 from public.product_reviews r where r.product_id = old.id or r.purchased_product_id = old.id)
    or exists (select 1 from public.store_offer_products p where p.product_id = old.id)
    or exists (select 1 from public.customer_cart_items i where i.product_id = old.id) then
    raise exception 'deactivate referenced products instead of deleting them' using errcode = '23503';
  end if;
  return old;
end;
$$;
create trigger products_protect_history_before_delete
  before delete on public.products for each row execute function public.protect_referenced_product_delete();

-- SHARE, unlike KEY SHARE, conflicts with the non-key UPDATE used to disable
-- a product. Hold it until commit, so an availability change and a purchase
-- cannot slip past each other between validation and snapshot insertion.
create function public.require_available_product_for_purchase()
returns trigger language plpgsql security definer set search_path = '' as $$
declare available_value boolean;
begin
  select p.is_available into available_value from public.products p
  where p.id = new.product_id for share;
  if not coalesce(available_value, false) then
    raise exception 'product_unavailable' using errcode = 'P1301';
  end if;
  return new;
end;
$$;
create trigger cart_items_require_available_product
  before insert or update of product_id, quantity on public.customer_cart_items
  for each row execute function public.require_available_product_for_purchase();
-- INSERT only: historical rows, status changes, totals, commissions and
-- settlements never need a currently active product to remain readable.
create trigger order_items_require_available_product
  before insert on public.store_order_items
  for each row execute function public.require_available_product_for_purchase();

-- Guard the whole cart before the first order row. In particular, the existing
-- offer RPC filters p.is_available while creating offer snapshots: without this
-- lock, a concurrent disable could otherwise omit an offer component entirely.
create function public.lock_available_cart_products_for_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare product_row record;
begin
  for product_row in
    select p.id, p.is_available from public.products p where p.id in (
      select ci.product_id from public.customer_cart_items ci
      join public.customer_carts c on c.id = ci.cart_id where c.customer_id = new.customer_id
      union
      select op.product_id from public.customer_cart_offer_selections selection
      join public.customer_carts c on c.id = selection.cart_id
      join public.store_offer_products op on op.offer_id = selection.offer_id
      where c.customer_id = new.customer_id
    ) order by p.id for share of p
  loop
    if not product_row.is_available then raise exception 'product_unavailable' using errcode = 'P1301'; end if;
  end loop;
  return new;
end;
$$;
create trigger customer_orders_lock_available_cart_products
  before insert on public.customer_orders
  for each row execute function public.lock_available_cart_products_for_order();

create function public.require_available_offer_products_for_cart()
returns trigger language plpgsql security definer set search_path = '' as $$
declare product_row record; offer_available boolean; has_products boolean := false;
begin
  select o.is_active and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now())
  into offer_available from public.store_offers o where o.id = new.offer_id for share;
  if not coalesce(offer_available, false) then
    raise exception 'product_unavailable' using errcode = 'P1301';
  end if;
  for product_row in
    select p.id, p.is_available from public.store_offer_products op
    join public.products p on p.id = op.product_id and p.store_id = op.store_id
    where op.offer_id = new.offer_id order by p.id for share of p
  loop
    has_products := true;
    if not product_row.is_available then
      raise exception 'product_unavailable' using errcode = 'P1301';
    end if;
  end loop;
  if not has_products then raise exception 'product_unavailable' using errcode = 'P1301'; end if;
  return new;
end;
$$;
create trigger cart_offers_require_available_products
  before insert or update of offer_id on public.customer_cart_offer_selections
  for each row execute function public.require_available_offer_products_for_cart();

revoke all on function public.protect_referenced_product_delete() from public, anon, authenticated;
revoke all on function public.require_available_product_for_purchase() from public, anon, authenticated;
revoke all on function public.lock_available_cart_products_for_order() from public, anon, authenticated;
revoke all on function public.require_available_offer_products_for_cart() from public, anon, authenticated;
commit;
