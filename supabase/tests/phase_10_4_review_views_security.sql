-- Manual staging/local SQL test AFTER 015. No production use: test-only policies
-- are created inside one transaction and ALWAYS rolled back. Never split this file.
-- Requires postgres/database owner capable of SET ROLE anon/authenticated.
-- Fixtures: public-eligible and hidden/disabled store/product reviews; multiple
-- ratings for at least one public store/product. Create fixtures via normal app/RPCs.
-- No persisted reviews or accounting records are inserted/updated by this test.
begin;
set local search_path=pg_catalog,pg_temp;
do $catalog$
declare v text;
begin
 if exists(select 1 from public.profiles where id='00000000-0000-0000-0000-000000000001'::uuid) then
  raise exception 'Choose an unused synthetic JWT subject for this test';
 end if;
 if exists(select 1 from pg_attribute a where a.attrelid in (
  'public.store_public_reviews'::regclass,'public.product_public_reviews'::regclass,
  'public.store_rating_summaries'::regclass,'public.product_rating_summaries'::regclass)
  and a.attnum>0 and not a.attisdropped and a.attname in ('customer_id','store_order_id','purchased_product_id')) then
  raise exception 'FAIL: private identifier exposed in a review view';
 end if;
 foreach v in array array['store_public_reviews','product_public_reviews','store_rating_summaries','product_rating_summaries'] loop
  if not exists(select 1 from pg_class c where c.oid=to_regclass('public.'||v)
   and c.reloptions @> array['security_invoker=true','security_barrier=true']) then raise exception 'FAIL: invoker/barrier missing: %',v; end if;
 end loop;
 if not (select relrowsecurity from pg_class where oid='public.store_reviews'::regclass)
 or not (select relrowsecurity from pg_class where oid='public.product_reviews'::regclass) then raise exception 'FAIL: review RLS disabled'; end if;
end;
$catalog$;
create temporary table expected_store_reviews on commit drop as
select sr.id,sr.store_id,sr.rating,sr.comment,sr.created_at,sr.updated_at from public.store_reviews sr
where public.store_accepts_new_orders(sr.store_id);
create temporary table expected_product_reviews on commit drop as
select pr.id,pr.product_id,pr.product_title_snapshot,pr.rating,pr.comment,pr.created_at,pr.updated_at
from public.product_reviews pr join public.products p on p.id=pr.product_id and p.store_id=pr.store_id
where p.is_available and public.store_accepts_new_orders(p.store_id);
create temporary table expected_store_summaries on commit drop as
select s.id as store_id,avg(r.rating)::numeric(3,2) as average_rating,count(r.id)::bigint as rating_count
from public.stores s left join expected_store_reviews r on r.store_id=s.id
where public.store_accepts_new_orders(s.id) group by s.id;
create temporary table expected_product_summaries on commit drop as
select p.id as product_id,avg(r.rating)::numeric(3,2) as average_rating,count(r.id)::bigint as rating_count
from public.products p left join expected_product_reviews r on r.product_id=p.id
where p.is_available and public.store_accepts_new_orders(p.store_id) group by p.id;
grant select on expected_store_reviews,expected_product_reviews,expected_store_summaries,expected_product_summaries to anon,authenticated;
do $fixtures$
begin
 if not exists(select 1 from expected_store_summaries where rating_count>=2)
 or not exists(select 1 from expected_product_summaries where rating_count>=2)
 or not exists(select id from public.store_reviews except select id from expected_store_reviews)
 or not exists(select id from public.product_reviews except select id from expected_product_reviews) then
  raise exception 'NEEDS FIXTURES: public multiple ratings AND hidden store/product reviews required; no empty-data PASS';
 end if;
end;
$fixtures$;
-- Synthetic non-owner/non-admin JWT subject, not an authenticated production user.
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $role_checks$
declare table_name text; column_name text;
begin
 -- Private column reads and SELECT * must fail even for rows otherwise public.
 for table_name,column_name in select * from (values
 ('store_reviews','customer_id'),('store_reviews','store_order_id'),
 ('product_reviews','customer_id'),('product_reviews','store_order_id'),
 ('product_reviews','purchased_product_id'),('product_reviews','store_id')) x(t,c) loop
  begin
   execute format('select %I from public.%I limit 1',column_name,table_name);
   raise exception 'FAIL: private column readable: %.%',table_name,column_name;
  exception when insufficient_privilege then null;
  end;
 end loop;
 foreach table_name in array array['store_reviews','product_reviews'] loop
  begin
   execute format('select * from public.%I limit 1',table_name);
   raise exception 'FAIL: full table readable: %',table_name;
  exception when insufficient_privilege then null;
  end;
  if has_table_privilege(current_user,'public.'||table_name,'INSERT')
   or has_table_privilege(current_user,'public.'||table_name,'UPDATE')
   or has_table_privilege(current_user,'public.'||table_name,'DELETE')
   or has_any_column_privilege(current_user,'public.'||table_name,'INSERT')
   or has_any_column_privilege(current_user,'public.'||table_name,'UPDATE') then
   raise exception 'FAIL: direct review writes granted';
  end if;
 end loop;
 -- Compare both directions, so missing public rows and extra private rows fail.
 if exists((select * from public.store_public_reviews except select * from expected_store_reviews)
  union all (select * from expected_store_reviews except select * from public.store_public_reviews)) then
  raise exception 'FAIL: store public rows differ';
 end if;
 if exists((select * from public.product_public_reviews except select * from expected_product_reviews)
  union all (select * from expected_product_reviews except select * from public.product_public_reviews)) then
  raise exception 'FAIL: product public rows differ';
 end if;
 if exists((select store_id,average_rating,rating_count from public.store_rating_summaries except select * from expected_store_summaries)
  union all (select * from expected_store_summaries except select store_id,average_rating,rating_count from public.store_rating_summaries)) then
  raise exception 'FAIL: store summaries differ';
 end if;
 if exists((select product_id,average_rating,rating_count from public.product_rating_summaries except select * from expected_product_summaries)
  union all (select * from expected_product_summaries except select product_id,average_rating,rating_count from public.product_rating_summaries)) then
  raise exception 'FAIL: product summaries differ';
 end if;
 -- Projection-only base reads must also obey exactly the same row visibility.
 if exists((select id from public.store_reviews except select id from expected_store_reviews)
  union all (select id from expected_store_reviews except select id from public.store_reviews)) then
  raise exception 'FAIL: store base RLS differs';
 end if;
 if exists((select id from public.product_reviews except select id from expected_product_reviews)
  union all (select id from expected_product_reviews except select id from public.product_reviews)) then
  raise exception 'FAIL: product base RLS differs';
 end if;
 raise notice 'PASS public rows, private columns, RLS and summaries: %',current_user;
end;
$role_checks$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $role_checks$
declare table_name text; column_name text;
begin
 -- Private column reads and SELECT * must fail even for rows otherwise public.
 for table_name,column_name in select * from (values
 ('store_reviews','customer_id'),('store_reviews','store_order_id'),
 ('product_reviews','customer_id'),('product_reviews','store_order_id'),
 ('product_reviews','purchased_product_id'),('product_reviews','store_id')) x(t,c) loop
  begin
   execute format('select %I from public.%I limit 1',column_name,table_name);
   raise exception 'FAIL: private column readable: %.%',table_name,column_name;
  exception when insufficient_privilege then null;
  end;
 end loop;
 foreach table_name in array array['store_reviews','product_reviews'] loop
  begin
   execute format('select * from public.%I limit 1',table_name);
   raise exception 'FAIL: full table readable: %',table_name;
  exception when insufficient_privilege then null;
  end;
  if has_table_privilege(current_user,'public.'||table_name,'INSERT')
   or has_table_privilege(current_user,'public.'||table_name,'UPDATE')
   or has_table_privilege(current_user,'public.'||table_name,'DELETE')
   or has_any_column_privilege(current_user,'public.'||table_name,'INSERT')
   or has_any_column_privilege(current_user,'public.'||table_name,'UPDATE') then
   raise exception 'FAIL: direct review writes granted';
  end if;
 end loop;
 -- Compare both directions, so missing public rows and extra private rows fail.
 if exists((select * from public.store_public_reviews except select * from expected_store_reviews)
  union all (select * from expected_store_reviews except select * from public.store_public_reviews)) then
  raise exception 'FAIL: store public rows differ';
 end if;
 if exists((select * from public.product_public_reviews except select * from expected_product_reviews)
  union all (select * from expected_product_reviews except select * from public.product_public_reviews)) then
  raise exception 'FAIL: product public rows differ';
 end if;
 if exists((select store_id,average_rating,rating_count from public.store_rating_summaries except select * from expected_store_summaries)
  union all (select * from expected_store_summaries except select store_id,average_rating,rating_count from public.store_rating_summaries)) then
  raise exception 'FAIL: store summaries differ';
 end if;
 if exists((select product_id,average_rating,rating_count from public.product_rating_summaries except select * from expected_product_summaries)
  union all (select * from expected_product_summaries except select product_id,average_rating,rating_count from public.product_rating_summaries)) then
  raise exception 'FAIL: product summaries differ';
 end if;
 -- Projection-only base reads must also obey exactly the same row visibility.
 if exists((select id from public.store_reviews except select id from expected_store_reviews)
  union all (select id from expected_store_reviews except select id from public.store_reviews)) then
  raise exception 'FAIL: store base RLS differs';
 end if;
 if exists((select id from public.product_reviews except select id from expected_product_reviews)
  union all (select id from expected_product_reviews except select id from public.product_reviews)) then
  raise exception 'FAIL: product base RLS differs';
 end if;
 raise notice 'PASS public rows, private columns, RLS and summaries: %',current_user;
end;
$role_checks$;
reset role;
-- This test-only restriction must suppress reviews through invoker views.
create policy phase_10_4_test_deny_store on public.store_reviews as restrictive for select to anon,authenticated using(false);
create policy phase_10_4_test_deny_product on public.product_reviews as restrictive for select to anon,authenticated using(false);
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $rls_proof$
begin
 if exists(select 1 from public.store_public_reviews) or exists(select 1 from public.product_public_reviews)
 or exists(select 1 from public.store_rating_summaries where rating_count<>0 or average_rating is not null)
 or exists(select 1 from public.product_rating_summaries where rating_count<>0 or average_rating is not null) then
  raise exception 'FAIL: invoker views bypass restrictive review RLS';
 end if;
 raise notice 'PASS: restrictive review RLS is enforced through all four views for %',current_user;
end;
$rls_proof$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $rls_proof$
begin
 if exists(select 1 from public.store_public_reviews) or exists(select 1 from public.product_public_reviews)
 or exists(select 1 from public.store_rating_summaries where rating_count<>0 or average_rating is not null)
 or exists(select 1 from public.product_rating_summaries where rating_count<>0 or average_rating is not null) then
  raise exception 'FAIL: invoker views bypass restrictive review RLS';
 end if;
 raise notice 'PASS: restrictive review RLS is enforced through all four views for %',current_user;
end;
$rls_proof$;
reset role;
rollback;
