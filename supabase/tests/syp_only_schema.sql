-- Read-only post-migration catalog and rejection checks. Manual local/staging psql.
\set ON_ERROR_STOP on
begin read only;
do $$ declare r record; labels text[]; rejected boolean; begin
 select array_agg(e.enumlabel order by e.enumsortorder) into labels from pg_enum e where e.enumtypid='public.currency_code'::regtype;
 if labels is distinct from array['SYP'] then raise exception 'currency enum is not SYP-only'; end if;
 if to_regtype('public.currency_code_previous') is not null then raise exception 'old enum still exists'; end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and column_name='currency' and table_name in ('products','store_offers','subscription_plans','delivery_zones','wallets','merchant_credit_limits')) then raise exception 'redundant currency column remains'; end if;
 for r in select table_name,column_name,is_nullable,column_default from information_schema.columns where table_schema='public' and udt_name='currency_code' and table_name in(select tablename from pg_tables where schemaname='public') loop
  if r.is_nullable<>'NO' or r.column_default not like '%SYP%' then raise exception 'missing SYP default/not-null: %.%',r.table_name,r.column_name; end if;
  if not exists(select 1 from pg_constraint c where c.conrelid=format('public.%I',r.table_name)::regclass and c.contype='c' and pg_get_constraintdef(c.oid) like '%'||r.column_name||'%SYP%') then raise exception 'missing SYP CHECK: %.%',r.table_name,r.column_name; end if;
  rejected:=false;
  begin execute format('update public.%I set %I = ''USD'' where false',r.table_name,r.column_name); exception when invalid_text_representation then rejected:=true; end;
  if not rejected then raise exception 'SQL accepted USD in %.%',r.table_name,r.column_name; end if;
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proargnames && array['input_currency','target_currency','payment_currency','credit_currency','remittance_currency','payout_currency','report_currency','selected_currency']) then raise exception 'old currency RPC parameter remains'; end if;
 for r in select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('save_store_offer','create_order_from_cart','record_subscription_payment','set_merchant_credit_limit','record_driver_cash_remittance','pay_driver_cash_credit','create_merchant_settlement_batch','record_merchant_settlement_payment','admin_financial_report','admin_sales_revenue_report','merchant_financial_account') loop
  if not r.prosecdef or r.proconfig is null or not ('search_path=""'=any(r.proconfig)) then raise exception 'security contract changed: %',r.proname; end if;
  if has_function_privilege('anon',r.oid,'execute') then raise exception 'anonymous RPC grant: %',r.proname; end if;
 end loop;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='customer_order_totals' and qual like '%driver_id%' and qual not like '%can_view_customer_order%') then raise exception '014 parent totals restriction lost'; end if;
 for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in('merchant_credit_limits','wallets','store_order_totals','customer_order_totals','customer_order_cash_obligations') loop
  if not exists(select 1 from pg_class c where c.oid=format('public.%I',r.relname)::regclass and c.relrowsecurity) then raise exception 'RLS disabled: %',r.relname; end if;
 end loop;
end; $$;
rollback;
