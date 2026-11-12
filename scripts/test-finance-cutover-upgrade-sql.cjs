// Isolated in-memory PostgreSQL (PGlite). Synthetic Auth/Storage baseline only;
// not Supabase Auth/PostgREST, signed JWT, remote deployment or concurrency proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require('../.expo/onboarding-sql-check/node_modules/@electric-sql/pglite');
const {btree_gist}=require('../.expo/onboarding-sql-check/node_modules/@electric-sql/pglite/dist/contrib/btree_gist.cjs');
async function main(){
 const db=await PGlite.create({extensions:{btree_gist}});let count=0;
 try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role supabase_admin superuser;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key default gen_random_uuid(),email text,raw_user_meta_data jsonb default '{}'::jsonb,raw_app_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 grant usage on schema auth to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid,owner_id text,metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 alter table storage.objects enable row level security;
 create publication supabase_realtime;`);
 const files=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&!f.includes('invoice_finance_cutover')).sort();
 for(const file of files){try{await db.exec(fs.readFileSync(path.join('supabase/migrations',file),'utf8'));}catch(e){throw Error('Migration '+file+': '+e.message);}}
 console.log('PASS '+files.length+' migrations on synthetic PostgreSQL baseline');count++;
 const q=async(s,p=[])=> {try{return (await db.query(s,p)).rows;}catch(e){console.error('At SQL:',s,e.where??'');throw e;}};
 const category=(await q('select id from public.store_categories where is_active limit 1'))[0].id;
 const add=async(role,app)=>(await q('insert into auth.users(email,raw_user_meta_data) values($1,$2) returning id',['upgrade@example.test',JSON.stringify({onboarding_version:3,signup_role:role,full_name:'اسم اختبار',signup_birth_date:'1990-01-01',...(app?{signup_application:app}:{})})]))[0].id;
 const admin=await add('customer');await q("update public.profiles set role='admin' where id=$1",[admin]);await q("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
 const plan=(await q("insert into public.subscription_plans(name,description,duration_months,price,commission_rate,product_limit,features,is_active) values('خطة قائمة','خطة تجريبية للترقية',1,100,10,50,'[\"ميزة اختبار\"]',true) returning id"))[0].id;
 const owner=await add('merchant',{contact_phone:'0991234567',store_name:'متجر قائم',category_id:category,store_address:'عنوان اختبار',plan_id:plan});
 const app=(await q('select id from public.merchant_applications where user_id=$1',[owner]))[0].id;await q("select public.review_merchant_application($1,'accepted',null)",[app]);
 const store=(await q('select s.id from public.stores s join public.merchants m on m.id=s.merchant_id where m.owner_user_id=$1',[owner]))[0].id;
 const pc=(await q("insert into public.product_categories(name,slug) values('تصنيف','upgrade-test') returning id"))[0].id;
 const product=(await q("insert into public.products(store_id,category_id,title,price) values($1,$2,'منتج قائم',10) returning id",[store,pc]))[0].id;
 const customer=await add('customer');await q("select set_config('request.jwt.claim.sub',$1,false)",[customer]);
 const cart=(await q('insert into public.customer_carts(customer_id) values($1) returning id',[customer]))[0].id;await q('insert into public.customer_cart_items(cart_id,product_id,quantity) values($1,$2,1)',[cart,product]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
 const zone=(await q("insert into public.delivery_zones(name,fixed_fee,additional_store_fee) values('منطقة',20,5) returning id"))[0].id;
 await q("select set_config('request.jwt.claim.sub',$1,false)",[customer]);
 const quote=(await q('select public.quote_c3_cart($1,$2) as r',[zone,customer]))[0].r;
 const order=(await q('select public.create_c3_order_from_cart($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',['المستلم','0991234567','عنوان الاختبار',zone,'',crypto.randomUUID(),quote.total,customer,quote.cart_signature]))[0].r;assert.equal(order.state,'completed');
 assert((await q('select count(*)::int as n from public.subscription_invoices'))[0].n>0);
 await db.exec(fs.readFileSync('supabase/migrations/20261116000100_invoice_finance_cutover.sql','utf8'));
 assert.equal((await q('select id from public.products where id=$1',[product]))[0].id,product);assert.equal((await q('select id from public.stores where id=$1',[store]))[0].id,store);
 assert.equal((await q('select count(*)::int as n from public.customer_orders'))[0].n,0);assert.equal((await q('select count(*)::int as n from public.money_invoices'))[0].n,0);
 assert.equal((await q("select to_regclass('public.wallets') as r"))[0].r,null);assert.equal((await q('select count(*)::int as n from public.merchant_terms'))[0].n,1);
 assert.equal((await q('select public.store_accepts_new_orders($1) as r',[store]))[0].r,true);
 console.log('PASS populated cutover: historical invoice, wallet, ledger and experimental order removed; accounts, merchant, store, product and commercial terms preserved with no invented opening money.');
 }finally{await db.close();}}
main().catch(e=>{console.error(e.message,e.detail??'');process.exitCode=1;});
