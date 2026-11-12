// Reproducible source of the cumulative migration. Never connects to a database.
const fs = require('node:fs');
// This generator predates the reviewed view/ACL fixes. Never overwrite an
// existing/applied migration; any future schema fix needs a new migration.
if (fs.existsSync('supabase/migrations/20261026000100_syp_only_architecture.sql')) {
  throw new Error('Archived generator: refusing to overwrite the applied SYP migration.');
}
const dir = 'supabase/migrations';
const functions = new Map(), views = new Map();
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !f.includes('syp_only')).sort()) {
  const sql = fs.readFileSync(`${dir}/${file}`, 'utf8').replace(/\r/g, '');
  for (const match of sql.matchAll(/create (?:or replace )?function public\.(\w+)\s*\([\s\S]*?\$\$;/gi)) functions.set(match[1], match[0]);
  for (const match of sql.matchAll(/create (?:or replace )?view public\.(\w+)[\s\S]*?;/gi)) views.set(match[1], match[0]);
}
const changed = ['save_store_offer', 'record_wallet_transaction', 'record_subscription_payment', 'set_merchant_credit_limit', 'record_driver_cash_remittance', 'pay_driver_cash_credit', 'create_merchant_settlement_batch', 'admin_financial_report', 'admin_sales_revenue_report', 'merchant_financial_account'];
const removed = { products:'currency', store_offers:'currency', subscription_plans:'currency', delivery_zones:'currency', wallets:'currency', merchant_credit_limits:'currency' };
const viewOrder = ['merchant_financial_positions','merchant_order_entitlement_positions','driver_cash_custody_positions','merchant_settlement_batch_positions','admin_cash_movement_events','admin_delivery_fee_report_rows','admin_merchant_payout_report_rows','admin_merchant_settlement_report_batches','admin_merchant_financial_report_events','admin_platform_revenue_report_events'];
let out = `-- Phase 11.4.0-B. SYP is the only monetary unit. No data conversion/deletion.
-- Generated from the LAST definitions in the preceding migrations by scripts/build-syp-migration.cjs.
begin;
set local lock_timeout = '10s';

-- Serialize migration with all table writers, including service-role writers.
do $$ declare r record; begin
  for r in select c.oid::regclass as relation from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by c.oid
  loop execute format('lock table %s in access exclusive mode',r.relation); end loop;
end; $$;

-- Report offending table/column/row identifiers. NEVER relabel a dollar amount.
do $$ declare r record; bad jsonb; problems jsonb := '[]'; begin
  if to_regtype('public.currency_code') is null then raise exception 'Missing prerequisite public.currency_code; establish the existing schema before applying this migration'; end if;
  for r in select table_name,column_name from information_schema.columns
    where table_schema='public' and (udt_name='currency_code' or column_name in ('currency','currency_snapshot','plan_currency_snapshot','delivery_currency'))
      and table_name in (select tablename from pg_tables where schemaname='public')
  loop
    execute format('select jsonb_agg(jsonb_build_object(''row'', coalesce(to_jsonb(t)->>''id'',to_jsonb(t)->>''user_id'',to_jsonb(t)->>''merchant_id'',to_jsonb(t)->>''store_order_id'',to_jsonb(t)->>''customer_order_id''),''currency'',%I::text)) from public.%I t where %I::text is distinct from ''SYP''',r.column_name,r.table_name,r.column_name) into bad;
    if bad is not null then problems := problems || jsonb_build_object('table',r.table_name,'column',r.column_name,'rows',bad); end if;
  end loop;
  -- Nested offer snapshots and financial audit snapshots are also monetary data.
  for r in select c.table_name,c.column_name from information_schema.columns c join pg_tables t on t.schemaname=c.table_schema and t.tablename=c.table_name where c.table_schema='public' and c.udt_name in ('json','jsonb') loop
    execute format('select jsonb_agg(jsonb_build_object(''row'',to_jsonb(t)->>''id'',''column'',%L)) from public.%I t where jsonb_path_exists(%I::jsonb, ''$.** ? (@.currency != "SYP" || @.currency_snapshot != "SYP" || @.plan_currency_snapshot != "SYP" || @.delivery_currency != "SYP")'')',r.column_name,r.table_name,r.column_name) into bad;
    if bad is not null then problems := problems || jsonb_build_object('table',r.table_name,'rows',bad); end if;
  end loop;
  if jsonb_array_length(problems)>0 then raise exception using message='SYP-only preflight failed: non-SYP development data', detail=problems::text; end if;
end; $$;

-- Preserve effective ACLs before replacing objects. Newly created functions must
-- not inherit PostgreSQL's default PUBLIC EXECUTE privilege.
create temporary table syp_acl on commit drop as
select 'view'::text as kind,c.relname as name,a.grantee,a.privilege_type,a.is_grantable
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
where n.nspname='public' and c.relname in (${viewOrder.map(x=>`'${x}'`).join(',')})
union all
select 'function',p.proname,a.grantee,a.privilege_type,a.is_grantable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
where n.nspname='public' and p.proname in (${changed.map(x=>`'${x}'`).join(',')});
`;
out += viewOrder.slice().reverse().map(v=>`drop view public.${v};`).join('\n')+'\n';
// Exact old signatures are obtained from the catalog; no CASCADE and no unrelated objects.
out += `do $$ declare r record; begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (${changed.map(x=>`'${x}'`).join(',')}) loop execute format('drop function %s',r.signature); end loop; end; $$;\n`;
out += `alter table public.wallet_transactions drop constraint wallet_transactions_user_id_currency_fkey;
alter table public.wallets drop constraint wallets_pkey;
alter table public.wallets add primary key(user_id);
alter table public.merchant_credit_limits drop constraint merchant_credit_limits_pkey;
alter table public.merchant_credit_limits add primary key(merchant_id);
alter table public.store_order_totals drop constraint store_order_totals_pkey;
alter table public.store_order_totals add primary key(store_order_id);
alter table public.customer_order_totals drop constraint customer_order_totals_pkey;
alter table public.customer_order_totals add primary key(customer_order_id);
alter table public.customer_order_cash_obligations drop constraint customer_order_cash_obligations_customer_order_id_currency_key;
alter table public.customer_order_cash_obligations add unique(customer_order_id);
`;
for (const [t,c] of Object.entries(removed)) out += `alter table public.${t} drop column ${c};\n`;
out += `alter table public.wallet_transactions add foreign key(user_id) references public.wallets(user_id) on delete restrict;
-- Replace, rather than edit pg_enum or retain a dormant USD label.
alter type public.currency_code rename to currency_code_previous;
create type public.currency_code as enum ('SYP');
do $$ declare r record; c record; begin
  for r in select table_name,column_name from information_schema.columns where table_schema='public' and udt_name='currency_code_previous' order by table_name,column_name loop
    -- The two original delivery CHECKs depend on the old enum operator.
    for c in select conname from pg_constraint where conrelid=format('public.%I',r.table_name)::regclass and contype='c' and pg_get_constraintdef(oid) like '%' || r.column_name || '%SYP%' loop execute format('alter table public.%I drop constraint %I',r.table_name,c.conname); end loop;
    execute format('alter table public.%I alter column %I drop default',r.table_name,r.column_name);
    execute format('alter table public.%I alter column %I type public.currency_code using %I::text::public.currency_code',r.table_name,r.column_name,r.column_name);
    execute format('alter table public.%I alter column %I set not null, alter column %I set default ''SYP''::public.currency_code, add constraint %I check (%I = ''SYP''::public.currency_code)',r.table_name,r.column_name,r.column_name,r.table_name || '_' || r.column_name || '_syp_only',r.column_name);
  end loop;
end; $$;
`;
function transform(name,s) {
 s=s.replace(/^create (?:or replace )?function/i,'create or replace function');
 // Remove obsolete input parameters; substitute the single server unit in bodies.
 for(const p of ['input_currency','target_currency','payment_currency','credit_currency','remittance_currency','payout_currency','report_currency','selected_currency']) {
  s=s.replace(new RegExp('\\b'+p+' public\\.currency_code(?: default null)?,?\\s*','g'),'');
  if(!['report_currency','selected_currency'].includes(p))s=s.replace(new RegExp('\\b'+p+'\\b','g'),"'SYP'::public.currency_code");
 }
 s=s.replace(/\((?:report_currency|selected_currency) is null or [a-z]+\.currency = (?:report_currency|selected_currency)\)/g,'true');
 // Removed pricing fields are server constants when producing financial snapshots.
 s=s.replace(/\bplan_row\.currency\b/g,"'SYP'::public.currency_code");
 if(['save_store_offer','add_customer_cart_offer','create_order_from_cart'].includes(name)) s=s.replace(/\b(?:p|o|offer_row|offer_item)\.currency\b/g,"'SYP'::public.currency_code");
 // p is also a financial-position alias: those references remain a fixed SYP unit.
 s=s.replace(/\bl\.currency = 'SYP'::public.currency_code/g,'true');
 if(name==='apply_wallet_transaction') s=s.replace(/ and w\.currency = new\.currency/g,'').replace(/ and currency = new\.currency/g,'');
 s=s.replace(/public\.wallets\(user_id, currency, balance\)/g,'public.wallets(user_id, balance)')
   .replace(/values \(application_row\.user_id, (?:'SYP'::public.currency_code|application_row\.plan_currency_snapshot), 0\)/g,'values (application_row.user_id, 0)')
   .replace(/on conflict \(user_id, currency\)/g,'on conflict (user_id)');
 if(name==='review_driver_application') s=s.replace(/values \(application_row.user_id, 'SYP', 0\)/,'values (application_row.user_id, 0)');
 if(name==='save_store_offer') {
  s=s.replace('bundle_price, currency, ends_at','bundle_price, ends_at').replace("'SYP'::public.currency_code, input_ends_at",'input_ends_at').replace("currency = 'SYP'::public.currency_code, ends_at",'ends_at');
  s=s.replace(/  product_currency public.currency_code;\n/,'').replace("select p.price, 'SYP'::public.currency_code into product_price, product_currency",'select p.price into product_price');
  s=s.replace(/product_currency <> 'SYP'::public.currency_code or /g,'').replace(/      if product_currency[^\n]+\n/g,'').replace('fixed discount must use the product currency and be less than its price','fixed discount must be less than the product price');
 }
 if(name==='set_merchant_credit_limit') s=s.replace('merchant_id, currency, credit_enabled','merchant_id, credit_enabled').replace("target_merchant, 'SYP'::public.currency_code, credit_is_enabled",'target_merchant, credit_is_enabled').replace('on conflict (merchant_id, currency)','on conflict (merchant_id)');
 if(name==='subscription_renewal_internal')s=s.replace(/ and l\.currency = chosen_currency/g,'');
 s=s.replace(/  if (?:'SYP'::public.currency_code|chosen_currency)::text not in \('SYP', 'USD'\) then[\s\S]*?  end if;\n/g,'');
 s=s.replace(/\s+or 'SYP'::public.currency_code <> application_row.plan_currency_snapshot/g,'');
 if(name==='create_order_from_cart') {
  s=s.replace(/  if \(\n    select count\(distinct cart_currency.currency\)[\s\S]*?  end if;\n/,'');
  // Record aliases in loops still need a name for the constant projection.
  s=s.replace(/p\.selling_unit, p\.price, 'SYP'::public.currency_code/g,"p.selling_unit, p.price, 'SYP'::public.currency_code as currency");
  s=s.replace('select soi.store_order_id, soi.currency, sum(soi.line_total)',"select soi.store_order_id, 'SYP'::public.currency_code, sum(soi.line_total)").replace('group by soi.store_order_id, soi.currency','group by soi.store_order_id');
  const start=s.indexOf('  insert into public.customer_order_totals('),end=s.indexOf('  delete from public.customer_cart_items',start);
  s=s.slice(0,start)+`  insert into public.customer_order_totals(customer_order_id, currency, items_subtotal, delivery_fee, total)
  select new_order, 'SYP', coalesce(sum(soi.line_total),0), zone_row.fixed_fee,
    coalesce(sum(soi.line_total),0) + zone_row.fixed_fee
  from public.store_order_items soi join public.store_orders so on so.id=soi.store_order_id
  where so.customer_order_id=new_order;

`+s.slice(end);
 }
 if(name==='create_delivered_order_cash_foundations') {
  const start=s.indexOf('  with delivered_totals as ('),end=s.indexOf('  insert into public.driver_delivery_fee_entitlements',start);
  s=s.slice(0,start)+`  insert into public.customer_order_cash_obligations(
    customer_order_id, delivery_task_id, driver_id, currency,
    delivered_store_items_amount, delivery_fee_amount, collectible_amount,
    delivery_zone_id, delivery_zone_name_snapshot, delivered_at)
  select order_row.id, task_row.id, task_row.driver_id, 'SYP',
    coalesce(sum(sot.items_subtotal),0), order_row.delivery_fee,
    coalesce(sum(sot.items_subtotal),0)+order_row.delivery_fee,
    order_row.delivery_zone_id, order_row.delivery_zone_name_snapshot, task_row.delivered_at
  from public.store_orders so join public.store_order_totals sot on sot.store_order_id=so.id
  where so.customer_order_id=target_customer_order and so.status='delivered'
  on conflict (customer_order_id) do nothing;

`+s.slice(end);
 }
 // Remove dead currency checks while retaining product-availability validation.
 s=s.replace(/\s+or 'SYP'::public.currency_code <> 'SYP'::public.currency_code/g,'');
 s=s.replace(/  if exists \((?:(?!end if;)[\s\S])*?\) then raise exception 'selected offer currency does not match its products'; end if;/,'');
 s=s.replace(/\s+if 'SYP'::public.currency_code <> 'SYP'::public.currency_code then[\s\S]*?end if;/g,'');
 s=s.replace(/on conflict \(customer_order_id, currency\)/g,'on conflict (customer_order_id)');
 // One lock namespace per owner, shared by both sides of each office operation.
 s=s.replace(/target_driver::text \|\| ':' \|\| 'SYP'::public.currency_code::text/g,"target_driver::text || ':SYP'")
 .replace(/target_merchant::text \|\| ':' \|\| 'SYP'::public.currency_code::text/g,"target_merchant::text || ':SYP'");
 return s;
}
// All currency-touching final function bodies, including trigger helpers, are
// republished so no lazily parsed PL/pgSQL body references a removed column.
for(const [name,s] of functions) if(/currency/i.test(s)) out += '\n'+transform(name,s)+'\n';
for(const name of viewOrder) {
 let v=views.get(name).replace(/^create (?:or replace )?view/i,'create view');
 v=v.replace(/select merchant_id, currency from public.merchant_credit_limits/g,"select merchant_id, 'SYP'::public.currency_code as currency from public.merchant_credit_limits").replace(/ and cl\.currency = k\.currency/g,'');
 if(['merchant_financial_positions','driver_cash_custody_positions'].includes(name)) {
  // A single owner key; preaggregate each source before joining (no fan-out).
  v=v.replace(/select (merchant_id|driver_id), (?:currency|'SYP'::public.currency_code as currency) from/g,'select $1 from');
  v=v.replace(/group by ([a-z]+\.)?(merchant_id|driver_id), ([a-z]+\.)?currency/g,'group by $1$2');
  v=v.replace(/select ([a-z]+\.)?(merchant_id|driver_id), ([a-z]+\.)?currency,/g,'select $1$2,');
  v=v.replace(/select k\.(merchant_id|driver_id), k\.currency,/g,"select k.$1, 'SYP'::public.currency_code as currency,");
  v=v.replace(/select\s+k\.driver_id,\s+k\.currency,/g,"select k.driver_id, 'SYP'::public.currency_code as currency,");
  v=v.replace(/ and [a-z]+\.currency = k\.currency/g,'');
  v=v.replace(/select k\.(merchant_id|driver_id),\s*\n/,"select k.$1, 'SYP'::public.currency_code as currency,\n");
 }
 out += '\n'+v+'\n';
}
for(const [index,table,columns] of [
 ['wallet_transactions_user_idx','wallet_transactions','user_id,created_at desc'],
 ['subscription_invoices_merchant_currency_status_idx','subscription_invoices','merchant_id,status,created_at desc'],
 ['subscription_payments_merchant_currency_received_idx','subscription_payments','merchant_id,received_at desc'],
 ['merchant_ledger_entries_exposure_idx','merchant_ledger_entries','merchant_id,created_at desc'],
 ['store_order_commissions_merchant_status_idx','store_order_commissions','merchant_id,status,created_at desc'],
 ['merchant_order_entitlements_merchant_idx','merchant_order_entitlements','merchant_id,status,delivered_at desc'],
 ['driver_cash_remittances_driver_idx','driver_cash_remittances','driver_id,received_at desc'],
 ['driver_cash_credit_payouts_driver_idx','driver_cash_credit_payouts','driver_id,paid_at desc'],
 ['merchant_settlement_batches_merchant_idx','merchant_settlement_batches','merchant_id,status,created_at desc']
]) out+=`drop index public.${index};\ncreate index ${index} on public.${table}(${columns});\n`;
out+=`alter table public.store_order_items add constraint store_order_items_offer_snapshot_syp
  check (offer_snapshot is null or not jsonb_path_exists(offer_snapshot, '$.** ? (@.currency != "SYP")'));
-- Fail closed if a dependency on the old enum was missed.
drop type public.currency_code_previous;
do $$ declare r record; role_name text; object_name text; begin
  for r in select * from syp_acl loop
    role_name := case when r.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(r.grantee)) end;
    if r.kind='view' then object_name := format('table public.%I',r.name);
    else select 'function ' || p.oid::regprocedure::text into object_name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=r.name; end if;
    if r.kind='function' then execute 'revoke all on ' || object_name || ' from public, anon, authenticated'; end if;
  end loop;
  for r in select * from syp_acl loop
    role_name := case when r.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(r.grantee)) end;
    if r.kind='view' then object_name := format('table public.%I',r.name);
    else select 'function ' || p.oid::regprocedure::text into object_name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=r.name; end if;
    execute 'grant ' || r.privilege_type || ' on ' || object_name || ' to ' || role_name || case when r.is_grantable then ' with grant option' else '' end;
  end loop;
end; $$;
notify pgrst, 'reload schema';
commit;
`;
fs.writeFileSync(`${dir}/20261026000100_syp_only_architecture.sql`,out);
