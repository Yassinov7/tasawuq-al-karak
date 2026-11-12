-- Discovery ordering only. Search relevance and catalog reads keep their own contracts.
create function public.read_customer_home_discovery(seed_value text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with eligible_stores as materialized (
    select s.id,md5(left(coalesce(seed_value,''),64)||':store:'||s.id::text) as rank
    from public.stores s where s.status='accepted' and public.store_accepts_new_orders(s.id)
  ), eligible_products as (
    select p.id,s.rank as store_rank,
      row_number() over(partition by p.store_id order by md5(left(coalesce(seed_value,''),64)||':product:'||p.id::text),p.id) as store_slot
    from public.products p join eligible_stores s on s.id=p.store_id where p.is_available
  )
  select jsonb_build_object(
    'store_ids',coalesce((select jsonb_agg(x.id order by x.rank,x.id) from
      (select id,rank from eligible_stores order by rank,id limit 6) x),'[]'::jsonb),
    'product_ids',coalesce((select jsonb_agg(x.id order by x.store_slot,x.store_rank,x.id) from
      (select id,store_slot,store_rank from eligible_products order by store_slot,store_rank,id limit 8) x),'[]'::jsonb)
  );
$$;
revoke all on function public.read_customer_home_discovery(text) from public,anon,authenticated;
grant execute on function public.read_customer_home_discovery(text) to anon,authenticated;
notify pgrst,'reload schema';
