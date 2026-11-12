-- Run after the category migration as the database owner. Read-only checks.
select scope, count(*) as categories,
  count(*) filter (where parent_id is not null) as children
from public.catalog_categories group by scope order by scope;

select
  (select count(*) from public.stores s left join public.catalog_categories c
    on c.id=s.category_id and c.scope='store' where c.id is null) as unmatched_stores,
  (select count(*) from public.merchant_applications a left join public.catalog_categories c
    on c.id=a.category_id and c.scope='store' where c.id is null) as unmatched_applications,
  (select count(*) from public.products p left join public.catalog_categories c
    on c.id=p.category_id and c.scope='product' where c.id is null) as unmatched_products;

with mirrors as (
  select 'store' as scope,id,name,slug,sort_order,is_active from public.store_categories
  union all
  select 'product',id,name,slug,sort_order,is_active from public.product_categories
)
select count(*) as mirror_mismatches
from public.catalog_categories c
full join mirrors m on m.id=c.id and m.scope=c.scope
left join public.catalog_categories p on p.id=c.parent_id
where c.id is null or m.id is null
  or (c.name,c.slug,c.sort_order,c.is_active and coalesce(p.is_active,true))
  is distinct from (m.name,m.slug,m.sort_order,m.is_active);
