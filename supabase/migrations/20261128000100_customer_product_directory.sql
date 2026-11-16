create schema if not exists product_directory_private;
revoke all on schema product_directory_private from public, anon, authenticated;

create function product_directory_private.normalize_text(value text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(value, '')),
      'أإآٱؤئىةـًٌٍَُِّْٰٕٖٜٟٓٔٗ٘ٙٚٛٝٞ', 'ااااوييه'),
    '[^[:alnum:]]+', ' ', 'g'));
$$;
revoke all on function product_directory_private.normalize_text(text) from public, anon, authenticated;

create function public.read_customer_product_directory(
  seed_value text, query_value text default '', category_value uuid default null,
  sort_value text default 'relevance', after_price numeric default null,
  after_rank text default null, after_id uuid default null
)
returns table (
  id uuid, store_id uuid, store_name text, category_id uuid, title text,
  description text, price numeric, selling_unit text, minimum_quantity numeric,
  quantity_step numeric, media_id uuid, media_path text, media_alt text,
  media_order integer, rank_key text
)
language sql stable security definer set search_path = '' as $$
  with recursive chosen_categories(id) as (
    select c.id from public.selectable_catalog_categories c
    where c.scope = 'product' and c.id = category_value
    union
    select c.id from public.selectable_catalog_categories c
    join chosen_categories parent on c.parent_id = parent.id
    where c.scope = 'product'
  ), terms as (
    select term
    from unnest(string_to_array(product_directory_private.normalize_text(left(query_value, 160)), ' ')) words(term)
    where term <> ''
  ), eligible as (
    select p.*, s.name as store_name,
      md5(left(coalesce(seed_value, ''), 64) || ':product:' || p.id::text) as rank_key
    from public.products p
    join public.stores s on s.id = p.store_id
    where p.is_available and s.status = 'accepted' and public.store_accepts_new_orders(s.id)
      and (category_value is null or p.category_id in (select c.id from chosen_categories c))
      and not exists (
        select 1 from terms
        where strpos(product_directory_private.normalize_text(
          p.title || ' ' || p.description || ' ' || p.selling_unit || ' ' || s.name
        ), terms.term) = 0
      )
  ), page as (
    select e.*
    from eligible e
    where case
      when sort_value = 'price-ascending' then after_id is null or (e.price, e.id) > (after_price, after_id)
      when sort_value = 'price-descending' then after_id is null or (e.price, e.id) < (after_price, after_id)
      else after_id is null or (e.rank_key, e.id) > (after_rank, after_id)
    end
    order by
      case when sort_value = 'price-ascending' then e.price end asc,
      case when sort_value = 'price-descending' then e.price end desc,
      case when sort_value not in ('price-ascending', 'price-descending') then e.rank_key end asc,
      case when sort_value = 'price-descending' then e.id end desc,
      e.id asc
    limit 13
  )
  select p.id, p.store_id, p.store_name, p.category_id, p.title, p.description,
    p.price, p.selling_unit, p.minimum_quantity, p.quantity_step,
    media.id, media.storage_path, media.alt_text, media.display_order, p.rank_key
  from page p
  left join lateral (
    select m.id, m.storage_path, m.alt_text, m.display_order
    from public.product_media m
    where m.product_id = p.id and m.media_type = 'image'
    order by m.display_order, m.id limit 1
  ) media on true
  order by
    case when sort_value = 'price-ascending' then p.price end asc,
    case when sort_value = 'price-descending' then p.price end desc,
    case when sort_value not in ('price-ascending', 'price-descending') then p.rank_key end asc,
    case when sort_value = 'price-descending' then p.id end desc,
    p.id asc;
$$;

revoke all on function public.read_customer_product_directory(text, text, uuid, text, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.read_customer_product_directory(text, text, uuid, text, numeric, text, uuid) to anon, authenticated;
notify pgrst, 'reload schema';
