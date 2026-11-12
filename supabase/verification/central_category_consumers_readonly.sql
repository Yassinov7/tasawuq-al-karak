-- Run after 20261122000200_central_category_consumers.sql as the database owner.
-- Expected: zero mismatches, followed by three true values.
with expected as (
  select c.id, c.scope, c.parent_id
  from public.catalog_categories c
  left join public.catalog_categories p on p.id=c.parent_id and p.scope=c.scope
  where c.is_active and (c.parent_id is null or p.is_active)
), differences as (
  (select * from expected except select id,scope,parent_id from public.selectable_catalog_categories)
  union all
  (select id,scope,parent_id from public.selectable_catalog_categories except select * from expected)
)
select count(*) as selectable_mismatches from differences;

select
  exists (select 1 from public.catalog_category_revision where id=1) as revision_ready,
  exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='catalog_category_revision') as realtime_ready,
  not has_table_privilege('anon','public.catalog_category_revision','UPDATE')
    and not has_table_privilege('authenticated','public.catalog_category_revision','UPDATE') as revision_read_only;
