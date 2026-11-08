-- Dashboard SQL Editor: replace IDs using your own owner account/store and a different account.
-- No real media is changed: synthetic asset rows only; everything rolls back.
begin;
select set_config('test.owner','REPLACE_OWNER_UUID',true);
select set_config('test.other','REPLACE_OTHER_USER_UUID',true);
select set_config('test.store','REPLACE_STORE_UUID',true);
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$begin
 if current_setting('test.owner')=current_setting('test.other') then raise exception 'distinct users required'; end if;
 if not public.branding_owner(current_setting('test.store')::uuid) then raise exception 'owner fixture invalid'; end if;
 if not public.store_accepts_new_orders(current_setting('test.store')::uuid) then raise exception 'eligible store required'; end if;
 if has_table_privilege('authenticated','public.store_branding_assets','UPDATE') or has_table_privilege('authenticated','public.store_branding_assets','INSERT') then raise exception 'direct mutation allowed'; end if;
 if not exists(select 1 from pg_class where oid='public.store_branding_assets'::regclass and relrowsecurity) then raise exception 'RLS disabled'; end if;
 if exists(select 1 from storage.buckets where id in ('store-logos','store-videos') and public) then raise exception 'public bucket';end if;
end $$;
set local role authenticated;
select public.register_store_branding('11000000-0000-4000-8000-000000000001',current_setting('test.store')::uuid,'logo','image/png',100);
select public.register_store_branding('11000000-0000-4000-8000-000000000002',current_setting('test.store')::uuid,'promo_video','video/mp4',100);
do $$begin
 begin perform public.publish_store_branding('11000000-0000-4000-8000-000000000001',null); raise exception 'missing upload accepted'; exception when raise_exception then if sqlerrm='missing upload accepted' then raise; end if; end;
 begin perform public.register_store_branding(gen_random_uuid(),current_setting('test.store')::uuid,'logo','image/png',4194305); raise exception 'oversize accepted'; exception when check_violation then null; end;
 if public.branding_upload_allowed('store-videos',current_setting('test.store')||'/logo/11000000-0000-4000-8000-000000000001.png') then raise exception 'bucket bypass';end if;
end $$;
reset role;
-- Synthetic Storage catalog records exercise SQL binding, not actual upload/content validation.
insert into storage.objects(bucket_id,name,metadata) select case kind when 'logo' then 'store-logos' else 'store-videos' end,storage_path,jsonb_build_object('size',byte_size,'mimetype',mime_type) from public.store_branding_assets where id in ('11000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002');
set local role authenticated;
select public.publish_store_branding('11000000-0000-4000-8000-000000000001',(select id from public.store_branding_assets where store_id=current_setting('test.store')::uuid and kind='logo' and is_current));
-- Publication retries are idempotent.
select public.publish_store_branding('11000000-0000-4000-8000-000000000001',null);
select public.publish_store_branding('11000000-0000-4000-8000-000000000002',(select id from public.store_branding_assets where store_id=current_setting('test.store')::uuid and kind='promo_video' and is_current));
select public.register_store_branding('11000000-0000-4000-8000-000000000003',current_setting('test.store')::uuid,'logo','image/png',100);
reset role;
insert into storage.objects(bucket_id,name,metadata) select 'store-logos',storage_path,jsonb_build_object('size',byte_size,'mimetype',mime_type) from public.store_branding_assets where id='11000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$begin
 begin perform public.publish_store_branding('11000000-0000-4000-8000-000000000003',null); raise exception 'stale replacement accepted';exception when serialization_failure then null;end;
 if not exists(select 1 from public.store_branding_assets where id='11000000-0000-4000-8000-000000000001' and is_current) then raise exception 'old logo lost';end if;
end $$;
select public.publish_store_branding('11000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000001');
do $$begin
 begin perform public.publish_store_branding('11000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003');raise exception 'retired reused';exception when raise_exception then if sqlerrm='retired reused' then raise;end if;end;
end $$;
select public.unpublish_store_branding('11000000-0000-4000-8000-000000000003');
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.store_branding_assets where id='11000000-0000-4000-8000-000000000003') then raise exception 'private row leaked';end if;
 begin perform public.register_store_branding(gen_random_uuid(),current_setting('test.store')::uuid,'logo','image/png',100);raise exception 'foreign registration';exception when insufficient_privilege then null;end;
 begin perform public.unpublish_store_branding('11000000-0000-4000-8000-000000000002');raise exception 'foreign removal';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
