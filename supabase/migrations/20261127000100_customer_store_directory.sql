-- The directory reads the same eligible stores as home discovery, with an independent cursor.
create schema if not exists store_directory_private;
revoke all on schema store_directory_private from public, anon, authenticated;

create function store_directory_private.normalize_name(value text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(value, '')),
      'أإآٱؤئىةـًٌٍَُِّْٰٕٖٜٟٓٔٗ٘ٙٚٛٝٞ', 'ااااوييه'),
    '[^[:alnum:]]+', ' ', 'g'));
$$;
revoke all on function store_directory_private.normalize_name(text) from public, anon, authenticated;

create function public.read_customer_store_directory(
  seed_value text, query_value text default '', category_value uuid default null,
  after_rank text default null, after_id uuid default null
)
returns table (id uuid, name text, category_id uuid, rank_key text)
language sql stable security definer set search_path = '' as $$
  with recursive chosen_categories(id) as (
    select c.id
    from public.selectable_catalog_categories c
    where c.scope = 'store' and c.id = category_value
    union
    select c.id
    from public.selectable_catalog_categories c
    join chosen_categories parent on c.parent_id = parent.id
    where c.scope = 'store'
  ), terms as (
    select term
    from unnest(string_to_array(store_directory_private.normalize_name(left(query_value, 160)), ' ')) as words(term)
    where term <> ''
  ), ranked as (
    select s.id, s.name, s.category_id,
      md5(left(coalesce(seed_value, ''), 64) || ':store:' || s.id::text) as rank_key
    from public.stores s
    where s.status = 'accepted'
      and (category_value is null or s.category_id in (select c.id from chosen_categories c))
      and not exists (
        select 1 from terms where strpos(store_directory_private.normalize_name(s.name), terms.term) = 0
      )
  )
  select r.id, r.name, r.category_id, r.rank_key
  from ranked r
  where (after_rank is null and after_id is null or (r.rank_key, r.id) > (after_rank, after_id))
    and public.store_accepts_new_orders(r.id)
  order by r.rank_key, r.id
  limit 13;
$$;
revoke all on function public.read_customer_store_directory(text, text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.read_customer_store_directory(text, text, uuid, text, uuid) to anon, authenticated;
notify pgrst, 'reload schema';
