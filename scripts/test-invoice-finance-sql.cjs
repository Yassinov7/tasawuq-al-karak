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
 const files=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
 for(const file of files){
  try{
   if(file==='20261122000100_central_catalog_categories.sql'){
    await db.exec("insert into public.product_categories(id,name,slug,is_active) values('10000000-0000-0000-0000-000000000001','تصنيف محلي سابق','historical-disabled',false)");
   }
   await db.exec(fs.readFileSync(path.join('supabase/migrations',file),'utf8'));
  }catch(e){throw Error('Migration '+file+': '+e.message);}
 }
 console.log('PASS '+files.length+' migrations on synthetic PostgreSQL baseline');count++;
 const q=async(s,p=[])=> (await db.query(s,p)).rows;
 const category=(await q('select id from public.store_categories where is_active limit 1'))[0].id;
 const meta=(role,app)=>({onboarding_version:3,signup_role:role,full_name:'اسم اختبار',signup_birth_date:'1990-01-01',...(app?{signup_application:app}:{})});
 const add=async(role,app)=> (await q('insert into auth.users(email,raw_user_meta_data) values($1,$2) returning id',['finance@example.test',JSON.stringify(meta(role,app))]))[0].id;
 const as=async(id)=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const admin=await add('customer');await q("update public.profiles set role='admin' where id=$1",[admin]);
 const plan=(await q("insert into public.subscription_plans(name,description,duration_months,price,commission_rate,product_limit,features,is_active) values('خطة اختبار','خطة تجريبية كاملة',1,100,10,50,'[\"ميزة اختبار\"]',true) returning id"))[0].id;
 const merchant=await add('merchant',{contact_phone:'0991234567',store_name:'متجر اختبار',category_id:category,store_address:'عنوان اختبار',plan_id:plan});
 const application=(await q('select id from public.merchant_applications where user_id=$1',[merchant]))[0].id;
 await as(admin);await q("select public.review_merchant_application($1,'accepted',null)",[application]);await q("select public.review_merchant_application($1,'accepted',null)",[application]);
 await as(merchant);
 const unavailable=(await q('select public.read_merchant_home_status($1,$2) r',[(await q('select s.id from public.stores s join public.merchants m on m.id=s.merchant_id where m.owner_user_id=$1',[merchant]))[0].id,merchant]))[0].r;
 assert.equal(unavailable.eligible,false);assert.equal(unavailable.reason,'subscription_unpaid');
 await assert.rejects(q('select public.read_admin_home($1)',[merchant]),/administrator required/);
 await as(admin);
 for(let i=0;i<25;i++){await db.exec('reset role');await add('driver',{contact_phone:'0991234567',vehicle_type:'دراجة'});}
 await as(admin);const home=(await q('select public.read_admin_home($1) r',[admin]))[0].r;
 assert.equal(home.driver_pending,25,'dashboard count is global, not the first page');
 await assert.rejects(q('select public.read_admin_home($1)',[merchant]),/administrator required/);
 console.log('PASS UI-02 global pending counts above one page, admin ACL and unpaid merchant eligibility');
 const sub=(await q("select * from public.money_invoices where owner_id=$1 and kind='SUB'",[merchant]));assert.equal(sub.length,1);assert.equal(sub[0].title,'فاتورة اشتراك');
 const subdue=(await q('select id from public.money_dues where invoice_id=$1',[sub[0].id]))[0].id;
 const act=async(input,key=crypto.randomUUID())=>(await q('select public.record_money_action($1,$2,$3) as r',[key,JSON.stringify(input),admin]))[0].r;
 assert.equal((await q("select public.read_money('',0,$1) as r",[merchant]))[0].r.receivable,'100.00');
 const subSet=await act({action:'settle',due:subdue,amount:'100',reason:'قبض اشتراك تجريبي'});assert.equal(subSet.state,'completed');
 await db.exec('reset role');const store=(await q('select s.id from public.stores s join public.merchants m on m.id=s.merchant_id where m.owner_user_id=$1',[merchant]))[0].id;
 await as(merchant);const ready=(await q('select public.read_merchant_home_status($1,$2) r',[store,merchant]))[0].r;
 assert.equal(ready.eligible,true);assert.equal(ready.reason,'ready');assert(ready.recheck_at);
 await assert.rejects(q('select public.read_merchant_home_status($1,$2)',[store,admin]),/account required/);
 await db.exec('reset role');await q("update public.merchant_terms set starts_at=now()-interval '2 months',expires_at=now()-interval '1 month' where merchant_id=(select id from public.merchants where owner_user_id=$1)",[merchant]);
 await as(merchant);assert.equal((await q('select public.read_merchant_home_status($1,$2) r',[store,merchant]))[0].r.reason,'subscription_expired');
 await db.exec('reset role');await q("update public.merchant_terms set starts_at=now(),expires_at=now()+interval '1 month' where merchant_id=(select id from public.merchants where owner_user_id=$1)",[merchant]);
 console.log('PASS UI-02 paid/expired eligibility uses unchanged order gate and rejects another expected account');
 const productCategory=(await q("insert into public.catalog_categories(scope,name,slug,is_active) values('product','تصنيف اختبار','finance-test',true) returning id"))[0].id;
 const product=(await q("insert into public.products(store_id,category_id,title,price,selling_unit,minimum_quantity,quantity_step,is_available) values($1,$2,'منتج اختبار',100,'قطعة',1,1,true) returning id",[store,productCategory]))[0].id;
 const customer=await add('customer');const driver=await add('driver',{contact_phone:'0991234567',vehicle_type:'دراجة'});
 const adId=crypto.randomUUID(),adPath=`${adId}/${crypto.randomUUID()}.jpg`;
 await q("insert into storage.objects(bucket_id,name,metadata) values('customer-home-ads',$1,'{\"mimetype\":\"image/jpeg\"}')",[adPath]);
 await as(admin);
 await q(`insert into public.customer_home_ads(id,title,admin_note,target_kind,target_id,media_kind,media_path,starts_at,ends_at,is_active)
   values($1,'إعلان الاختبار','ملاحظة خاصة','product',$2,'image',$3,now()-interval '1 hour',now()+interval '1 hour',true)`,[adId,product,adPath]);
 const publicAds=()=>q('select * from public.read_customer_home_ads()');
 await as(customer);
 assert.equal((await q('select id from public.customer_home_ads')).length,0);
 assert.equal((await publicAds())[0].id,adId);
 assert(!Object.hasOwn((await publicAds())[0],'admin_note'));
 assert(!Object.hasOwn((await publicAds())[0],'advertiser'));
 await as(merchant);
 assert.equal((await q('update public.customer_home_ads set is_active=false where id=$1 returning id',[adId])).length,0);
 await db.exec('reset role; set role anon');
 assert.equal((await publicAds())[0].id,adId);
 assert((await q('select id from public.stores where id=$1',[store])).length);
 assert((await q('select id from public.products where id=$1',[product])).length);
 assert.equal((await q('select public.can_read_customer_ad_media($1) as r',[adPath]))[0].r,true);
 const discover=async seed=>(await q('select public.read_customer_home_discovery($1) as r',[seed]))[0].r;
 const firstDiscovery=await discover('stable-session');
 assert(firstDiscovery.store_ids.includes(store));assert(firstDiscovery.product_ids.includes(product));
 assert.deepEqual(await discover('stable-session'),firstDiscovery);
 await db.exec('reset role');await q('update public.products set is_available=false where id=$1',[product]);
 await db.exec('set role anon');
 assert.equal((await publicAds()).length,0);assert.equal((await q('select public.can_read_customer_ad_media($1) as r',[adPath]))[0].r,false);
 assert(!(await discover('stable-session')).product_ids.includes(product));
 await db.exec('reset role');await q('update public.products set is_available=true where id=$1',[product]);
 await as(admin);await q("update public.customer_home_ads set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=$1",[adId]);
 await db.exec('reset role; set role anon');assert.equal((await publicAds()).length,0);
 await db.exec('reset role');
 const offer=(await q("insert into public.store_offers(store_id,title,offer_type,bundle_price) values($1,'عرض اختبار','bundle',80) returning id",[store]))[0].id;
 await q("insert into public.store_offer_products(store_id,offer_id,product_id,item_role,quantity) values($1,$2,$3,'bundle',1)",[store,offer,product]);
 for(const [kind,target] of [['store',store],['offer',offer]]){
  await db.exec('reset role');
  const id=crypto.randomUUID(),path=`${id}/${crypto.randomUUID()}.mp4`;
  await q("insert into storage.objects(bucket_id,name,metadata) values('customer-home-ads',$1,'{\"mimetype\":\"video/mp4\"}')",[path]);
  await as(admin);
  await q("insert into public.customer_home_ads(id,target_kind,target_id,media_kind,media_path,starts_at,ends_at,is_active) values($1,$2,$3,'video',$4,now()+interval '1 hour',now()+interval '2 hours',true)",[id,kind,target,path]);
  await as(customer);assert.equal((await publicAds()).length,0);
  await as(admin);await q("update public.customer_home_ads set starts_at=now()-interval '1 hour' where id=$1",[id]);
  await as(customer);assert.equal((await publicAds())[0].media_kind,'video');
  assert.equal((await publicAds())[0].target_kind,kind);
  await as(admin);await q("update public.customer_home_ads set is_active=false where id=$1",[id]);
  await as(customer);assert.equal((await publicAds()).length,0);
 }
 const registerLogo=async()=>{
  await as(merchant);
  const result=(await q("select public.register_store_branding($1,$2,'logo','image/png',100) as asset",[crypto.randomUUID(),store]))[0].asset;
  await db.exec('reset role');
  await q("insert into storage.objects(bucket_id,name,metadata) values('store-logos',$1,'{\"mimetype\":\"image/png\",\"size\":100}')",[result.storage_path]);
  return result;
 };
 const logo=await registerLogo();
 const currentLogos=()=>q("select id from public.store_branding_assets where store_id=$1 and kind='logo' and is_current",[store]);
 await as(customer);assert.equal((await currentLogos()).length,0);
 await as(merchant);await q("select public.publish_store_branding($1,null)",[logo.id]);
 await as(customer);assert.equal((await currentLogos())[0].id,logo.id);
 assert.equal((await q("select public.branding_read_allowed('store-logos',$1) r",[logo.storage_path]))[0].r,true);
 const replacement=await registerLogo();
 await as(customer);assert.equal((await currentLogos())[0].id,logo.id);
 await as(merchant);await q("select public.publish_store_branding($1,$2)",[replacement.id,logo.id]);
 await as(customer);assert.equal((await currentLogos())[0].id,replacement.id);
 assert.equal((await q("select public.branding_read_allowed('store-logos',$1) r",[logo.storage_path]))[0].r,false);
 await db.exec('reset role');
 await q("select set_config('request.jwt.claim.sub','',false)");
 await db.exec('set role anon');
 assert.equal((await currentLogos())[0].id,replacement.id);
 assert.equal((await q("select public.branding_read_allowed('store-logos',$1) r",[replacement.storage_path]))[0].r,true);
 assert.equal((await q("select public.branding_read_allowed('store-logos',$1) r",[logo.storage_path]))[0].r,false);
 assert.equal((await q("select id from public.store_branding_assets where id=$1",[logo.id])).length,0);
 await db.exec('reset role');
 console.log('PASS home ads: owner-only administration, public projection, expiry, eligible target and stable public discovery');
 await as(customer);await assert.rejects(q('select public.read_merchant_home_status($1,$2)',[store,customer]),/owned store required/);await db.exec('reset role');
 await as(admin);const dap=(await q('select id from public.driver_applications where user_id=$1',[driver]))[0].id;await q("select public.review_driver_application($1,'accepted',null)",[dap]);
 assert.equal((await act({action:'policy',owner:driver,mode:'fixed',value:'10',reason:'أجر اختبار المهمة'})).state,'completed');
 await db.exec('reset role');const zone=(await q("insert into public.delivery_zones(name,fixed_fee,additional_store_fee,is_active) values('منطقة اختبار',20,5,true) returning id"))[0].id;
 const cart=(await q('insert into public.customer_carts(customer_id) values($1) returning id',[customer]))[0].id;
 await q('insert into public.customer_cart_items(cart_id,product_id,quantity) values($1,$2,2)',[cart,product]);
 await as(customer);const quote=(await q('select public.quote_c3_cart($1,$2) as r',[zone,customer]))[0].r;assert.equal(quote.total,220);
 const orderKey=crypto.randomUUID();const args=['اسم المستلم','0991234567','عنوان الاختبار',zone,'ملاحظة',orderKey,quote.total,customer,quote.cart_signature];
 const create=async()=>(await q('select public.create_c3_order_from_cart($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',args))[0].r;
 const order=await create();assert.equal(order.state,'completed');assert.equal((await create()).order_id,order.order_id);
 await as(merchant);const sor=(await q('select id from public.store_orders where customer_order_id=$1',[order.order_id]))[0].id;
 await q("select public.update_store_order_status($1,'preparing',null)",[sor]);await q("select public.update_store_order_status($1,'ready_for_pickup',null)",[sor]);
 await as(driver);await q('select public.set_driver_availability(true)');await q('select public.accept_delivery_task($1)',[order.order_id]);
 const task=(await q('select id from public.delivery_tasks where customer_order_id=$1',[order.order_id]))[0].id;
 await q('select public.confirm_c4_store_pickup($1,$2,$3)',[task,sor,driver]);
 const deliveryKey=crypto.randomUUID();const delivered=(await q('select public.complete_delivery_and_collect_cash($1,$2,$3,1) as r',[task,driver,deliveryKey]))[0].r;assert.equal(delivered.state,'completed');
 assert.deepEqual((await q('select public.complete_delivery_and_collect_cash($1,$2,$3,1) as r',[task,driver,deliveryKey]))[0].r,delivered);
 const driverAccount=(await q("select public.read_money('',0,null) as r"))[0].r;assert.equal(driverAccount.receivable,'220.00');assert.equal(driverAccount.payable,'10.00');
 const driverPage=async(search,kind,before)=>(await q(
   'select public.read_driver_money($1,$2,$3,$4) as r',
   [search,kind,before?.created_at??null,before?.id??null]
 ))[0].r;
 await db.exec('reset role');
 const taskRef=(await q("select reference from public.commerce_references where kind='TSK' and record_id=$1",[task]))[0].reference;
 await as(driver);
 const activeDelivery=await driverPage(taskRef,'DLV');
 assert.equal(activeDelivery.rows.length,1);assert.equal(activeDelivery.rows[0].task_id,task);
 assert.equal(activeDelivery.collection_due,driverAccount.collection_due);
 assert.equal(activeDelivery.payable,driverAccount.payable);
 assert.equal((await driverPage(taskRef,'SET')).rows.length,0);
 await as(merchant);const merchantAccount=(await q("select public.read_money('',0,null) as r"))[0].r;assert.equal(merchantAccount.payable,'180.00');assert.equal(merchantAccount.receivable,'0.00');
 await as(customer);const inv=(await q('select public.find_order_invoice($1) as id',[order.order_id]))[0].id;const customerInvoice=(await q('select public.read_money_invoice($1) as r',[inv]))[0].r;
 assert.equal(customerInvoice.amount,'220.00');assert(!JSON.stringify(customerInvoice).includes('merchant_net'));assert(!JSON.stringify(customerInvoice).includes('commission'));assert.equal((await q('select count(*)::int as n from public.money_invoices'))[0].n,1);
 await assert.rejects(()=>q('update public.money_invoices set amount=1 where id=$1',[inv]));
 await as(admin);const dues=await q("select d.*,i.kind from public.money_dues d join public.money_invoices i on i.id=d.invoice_id where d.owner_id=$1 and i.kind='DLV'",[driver]);const collection=dues.find(d=>d.purpose==='collection'),wage=dues.find(d=>d.purpose==='wage');
 const unpaidSale=(await q("select d.id from public.money_dues d join public.money_invoices i on i.id=d.invoice_id where i.kind='SAL' and d.owner_id=$1",[merchant]))[0].id;
 assert.equal((await act({action:'settle',due:unpaidSale,amount:'180',reason:'رفض الصرف فوق نقد الخزينة'})).state,'rejected');
 await assert.rejects(()=>q('select public.record_money_action($1,$2,$3)',[crypto.randomUUID(),JSON.stringify({action:'settle',due:unpaidSale,amount:'1',reason:'حماية تغير الحساب'}),customer]));
 const remitKey=crypto.randomUUID(),remitInput={action:'settle',due:collection.id,amount:'220',reason:'استلام كامل التحصيل'};
 const remit=await act(remitInput,remitKey);assert.equal(remit.state,'completed');assert.deepEqual(await act(remitInput,remitKey),remit);
 assert.equal((await act({action:'settle',due:collection.id,amount:'1',reason:'محاولة زيادة ممنوعة'})).state,'rejected');
 assert.equal((await act({action:'settle',due:wage.id,amount:'10',reason:'صرف أجر المهمة'})).state,'completed');
 const sale=(await q("select d.id from public.money_dues d join public.money_invoices i on i.id=d.invoice_id where i.kind='SAL' and d.owner_id=$1",[merchant]))[0].id;
 const half=await act({action:'settle',due:sale,amount:'80',reason:'دفعة مستحق التاجر'});assert.equal(half.state,'completed');
 assert.equal((await q("select public.read_money('',0,$1) as r",[merchant]))[0].r.payable,'100.00');
 assert.equal((await act({action:'settle',due:sale,amount:'100',reason:'باقي مستحق التاجر'})).state,'completed');
 assert.equal((await q("select public.read_money('',0,null) as r"))[0].r.cash,'130.00');
 // Correction of a settlement restores exactly its allocation and cash, once.
 const correction=await act({action:'correct',invoice:half.invoice_id,reason:'تصحيح دفعة اختبار'});assert.equal(correction.state,'completed');
 assert.equal((await q("select public.read_money('',0,$1) as r",[merchant]))[0].r.payable,'80.00');
 assert.equal((await q("select public.read_money('',0,null) as r"))[0].r.cash,'210.00');
 // Salary is explicit, mutually exclusive with task wages, and periods cannot overlap.
 assert.equal((await act({action:'policy',owner:driver,mode:'salary',value:'50',reason:'اختبار سياسة الراتب'})).state,'completed');
 assert.equal((await act({action:'salary',owner:driver,from:'2020-01-01',until:'2020-02-01',reason:'راتب فترة اختبار مكتملة'})).state,'completed');
 assert.equal((await act({action:'salary',owner:driver,from:'2020-01-15',until:'2020-02-15',reason:'راتب فترة متداخلة ممنوعة'})).state,'rejected');
 // Two stores, one rejection: fee falls to one-store fee, cancelled SAL never accrues.
 await db.exec('reset role');
 const merchant2=await add('merchant',{contact_phone:'0991234567',store_name:'متجر ثان',category_id:category,store_address:'عنوان ثان',plan_id:plan});
 await as(admin);const app2=(await q('select id from public.merchant_applications where user_id=$1',[merchant2]))[0].id;
 await q("select public.review_merchant_application($1,'accepted',null)",[app2]);
 const due2=(await q("select d.id from public.money_dues d join public.money_invoices i on i.id=d.invoice_id where i.kind='SUB' and d.owner_id=$1",[merchant2]))[0].id;
 await act({action:'settle',due:due2,amount:'100',reason:'قبض الاشتراك الثاني'});
 await act({action:'policy',owner:driver,mode:'percentage',value:'50',reason:'نسبة اختبار من رسم التوصيل'});
 await db.exec('reset role');const store2=(await q('select s.id from public.stores s join public.merchants m on m.id=s.merchant_id where m.owner_user_id=$1',[merchant2]))[0].id;
 const product2=(await q("insert into public.products(store_id,category_id,title,price) values($1,$2,'منتج ثان',50) returning id",[store2,productCategory]))[0].id;
 await q('insert into public.customer_cart_items(cart_id,product_id,quantity) values($1,$2,1),($1,$3,1)',[cart,product,product2]);
 await as(customer);const quote2=(await q('select public.quote_c3_cart($1,$2) as r',[zone,customer]))[0].r;assert.equal(quote2.total,175);
 const o2=(await q('select public.create_c3_order_from_cart($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',['المستلم','0991234567','عنوان الاختبار',zone,'',crypto.randomUUID(),quote2.total,customer,quote2.cart_signature]))[0].r.order_id;
 await as(merchant2);const sor2=(await q('select id from public.store_orders where customer_order_id=$1 and store_id=$2',[o2,store2]))[0].id;
 await q("select public.update_store_order_status($1,'rejected','غير متوفر')",[sor2]);
 await as(merchant);const sor1=(await q('select id from public.store_orders where customer_order_id=$1 and store_id=$2',[o2,store]))[0].id;
 await q("select public.update_store_order_status($1,'preparing',null)",[sor1]);await q("select public.update_store_order_status($1,'ready_for_pickup',null)",[sor1]);
 await as(driver);await q('select public.accept_delivery_task($1)',[o2]);const task2=(await q('select id from public.delivery_tasks where customer_order_id=$1',[o2]))[0].id;
 assert.equal((await q('select public.complete_delivery_and_collect_cash($1,$2,$3,2) as r',[task2,driver,crypto.randomUUID()]))[0].r.code,'pickups_incomplete');
 await q('select public.confirm_c4_store_pickup($1,$2,$3)',[task2,sor1,driver]);
 const delivered2=(await q('select public.complete_delivery_and_collect_cash($1,$2,$3,2) as r',[task2,driver,crypto.randomUUID()]))[0].r;assert.equal(delivered2.amount,'120.00');
 await as(admin);assert.equal((await q("select public.read_money('',0,$1) as r",[merchant2]))[0].r.payable,'0');
 const dlv2=(await q("select details from public.money_invoices where task_id=$1 and kind='DLV'",[task2]))[0].details;assert.equal(dlv2.wage,'10.00');
 assert.equal((await q("select status from public.money_invoices where kind='SAL' and store_order_id=$1",[sor2]))[0].status,'cancelled');
 await as(customer);const inv2=(await q('select public.find_order_invoice($1) as id',[o2]))[0].id;assert.equal((await q('select public.read_money_invoice($1) as r',[inv2]))[0].r.amount,'120.00');
 await as(admin);const found=(await q("select public.read_money($1,0,null) as r",[(await q('select public.get_c3_order_context($1) as r',[[o2]]))[0].r[o2].references['ORD:'+o2]]))[0].r;assert.equal(found.rows.length,4);
 console.log('PASS two-store rejection: reduced delivery fee, one task, full-collection duty, percentage wage, cancelled merchant invoice, customer effective total and reference search');
 // Both stores delivered: one task, all pickups mandatory, independent SAL accruals.
 await db.exec('reset role');await q('insert into public.customer_cart_items(cart_id,product_id,quantity) values($1,$2,1),($1,$3,1)',[cart,product,product2]);
 await as(customer);const quote3=(await q('select public.quote_c3_cart($1,$2) as r',[zone,customer]))[0].r;
 const o3=(await q('select public.create_c3_order_from_cart($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',['المستلم','0991234567','عنوان الاختبار',zone,'',crypto.randomUUID(),quote3.total,customer,quote3.cart_signature]))[0].r.order_id;
 const children=[];for(const who of [merchant,merchant2]){await as(who);const child=(await q('select id from public.store_orders where customer_order_id=$1',[o3]))[0].id;children.push(child);await q("select public.update_store_order_status($1,'preparing',null)",[child]);await q("select public.update_store_order_status($1,'ready_for_pickup',null)",[child]);}
 await as(driver);await q('select public.accept_delivery_task($1)',[o3]);const task3=(await q('select id from public.delivery_tasks where customer_order_id=$1',[o3]))[0].id;
 await q('select public.confirm_c4_store_pickup($1,$2,$3)',[task3,children[0],driver]);assert.equal((await q('select public.complete_delivery_and_collect_cash($1,$2,$3,1) as r',[task3,driver,crypto.randomUUID()]))[0].r.code,'pickups_incomplete');
 await q('select public.confirm_c4_store_pickup($1,$2,$3)',[task3,children[1],driver]);assert.equal((await q('select public.complete_delivery_and_collect_cash($1,$2,$3,1) as r',[task3,driver,crypto.randomUUID()]))[0].r.amount,'175.00');
 await as(admin);assert.equal((await q("select count(*)::int as n from public.money_invoices where kind='SAL' and customer_order_id=$1 and status='confirmed'",[o3]))[0].n,2);
 const saleNets=await q("select details->>'merchant_net' as net from public.money_invoices where kind='SAL' and customer_order_id=$1 order by amount",[o3]);assert.deepEqual(saleNets.map(r=>r.net),['45.00','90.00']);
 console.log('PASS full multi-store delivery: one task, both pickups required, two exact merchant invoices and one full customer collection');
 assert.equal((await act({action:'settle',due:collection.id,amount:'not-a-number',reason:'رفض مبلغ غير صالح'})).state,'rejected');
 const kinds=(await q('select distinct kind from public.money_invoices')).map(r=>r.kind).sort();assert.deepEqual(kinds,['COR','DLV','INV','SAL','SET','SUB','WAG']);
 await as(customer);await assert.rejects(()=>q('select public.read_money_invoice($1)',[sub[0].id]));await assert.rejects(()=>q('select public.record_money_action($1,$2,$3)',[crypto.randomUUID(),JSON.stringify(remitInput),admin]));
 await db.exec('reset role');const broken=await q("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','commerce_private','money_private') and p.prokind='f' and p.prosrc like '%finance_private.%'");assert.deepEqual(broken,[]);
 console.log('PASS full invoice flow: approval, subscription receipt, cart quote/create/retry, merchant readiness, pickup, delivery, full collection, wage, partial/full sale settlement, correction and salary overlap');
 console.log('PASS all seven invoice kinds, exact treasury/balances, owner RLS and denied direct writes. Synthetic PostgreSQL only; real JWT, concurrent connections, devices and hosted services remain untested.');
 // Notification emission is part of the confirmed transaction, including retry/correction paths.
 assert.equal((await q("select count(*)::int n from public.notifications where event_key=$1",['invoice:'+sub[0].id+':confirmed']))[0].n,1);
 assert.equal((await q("select count(*)::int n from public.notifications where event_key like 'invoice:%'"))[0].n,(await q("select count(*)::int n from public.money_invoices where status='confirmed'"))[0].n);
 const before=(await q('select count(*)::int n from public.notifications'))[0].n;
 await db.exec('begin');await q("update public.money_invoices set cash_direction=cash_direction where id=$1",[sub[0].id]);await db.exec('rollback');
 assert.equal((await q('select count(*)::int n from public.notifications'))[0].n,before);
 const installation=crypto.randomUUID();await as(merchant);
 await q('select public.register_push_device($1,$2,$3,$4)',[installation,'ExpoPushToken[synthetic]','android',merchant]);
 await assert.rejects(()=>q('select * from public.push_devices'));
 await assert.rejects(()=>q('select public.claim_push_deliveries(5)'));
 await assert.rejects(()=>q('select public.register_push_device($1,$2,$3,$4)',[installation,'ExpoPushToken[synthetic]','android',customer]));
 await db.exec('reset role');
 await q("insert into public.notifications(user_id,type,title,body,data) values($1,'system','test','test','{}')",[merchant]);
 await q("select set_config('request.jwt.claim.role','service_role',false)");await db.exec('set role service_role');
 const claimed=(await q('select public.claim_push_deliveries(5) r'))[0].r;assert.equal(claimed.length,1);
 assert.equal((await q('select public.claim_push_deliveries(5) r'))[0].r.length,0,'active lease excludes a second claim');
 await q('select public.finish_push_delivery($1,$2,$3,null,null)',[claimed[0].id,crypto.randomUUID(),'sent']);
 await q('select public.finish_push_delivery($1,$2,$3,$4,null)',[claimed[0].id,claimed[0].lease,'ticket','receipt-test']);
 await db.exec('reset role');assert.equal((await q('select state from public.push_deliveries where id=$1',[claimed[0].id]))[0].state,'ticket');
 await as(customer);await q('select public.register_push_device($1,$2,$3,$4)',[installation,'ExpoPushToken[synthetic]','android',customer]);
 await db.exec('reset role');await q("update public.push_deliveries set next_attempt=now()-interval '1 minute'");
 await q("select set_config('request.jwt.claim.role','service_role',false)");await db.exec('set role service_role');
 assert.equal((await q('select public.claim_push_deliveries(5) r'))[0].r.length,0,'old account delivery is discarded on device reassignment');
 await db.exec('reset role');assert.equal((await q('select state from public.push_deliveries where id=$1',[claimed[0].id]))[0].state,'dead');
 console.log('PASS financial notifications deduplicated, transaction rollback, push device ACL, expected owner, leases, receipt state and account reassignment. No hosted/parallel-session proof.');
 // UX-05: test the existing commerce flow with a deliberately broken Push queue.
 assert((await q("select count(*)::int n from public.notifications where user_id=$1 and data->>'applicationId'=$2",[admin,application]))[0].n>=1,'admin receives application review event');
 const childNotification=(await q("select data from public.notifications where user_id=$1 and event_key like 'store-created:%' limit 1",[merchant]))[0];assert(childNotification.data.storeOrderId);
 assert.equal((await q("select count(*)::int n from public.notifications where event_key is not null"))[0].n,(await q("select count(distinct event_key)::int n from public.notifications where event_key is not null"))[0].n);
 await db.exec("create function public.synthetic_push_failure() returns trigger language plpgsql as $$begin raise exception 'synthetic queue unavailable';end$$;create trigger synthetic_push_failure before insert on public.push_deliveries for each row execute function public.synthetic_push_failure();");
 await q('insert into public.customer_cart_items(cart_id,product_id,quantity) values($1,$2,1)',[cart,product]);
 await as(customer);const quote4=(await q('select public.quote_c3_cart($1,$2) r',[zone,customer]))[0].r;
 const order4=(await q('select public.create_c3_order_from_cart($1,$2,$3,$4,$5,$6,$7,$8,$9) r',['مستلم','0991234567','عنوان الاختبار',zone,'',crypto.randomUUID(),quote4.total,customer,quote4.cart_signature]))[0].r;assert(order4.order_id,'queue failure cannot roll back the order');
 await db.exec('reset role');const n4=(await q("select id from public.notifications where event_key=$1",['order-created:'+order4.order_id+':'+customer]))[0].id;
 assert.equal((await q('select count(*)::int n from public.push_deliveries where notification_id=$1',[n4]))[0].n,0);
 await db.exec('drop trigger synthetic_push_failure on public.push_deliveries;drop function public.synthetic_push_failure();');
 await q('update public.order_pricing_current set review_required=true where customer_order_id=$1',[order4.order_id]);
 await as(admin);const reviewHome=(await q('select public.read_admin_home($1) r',[admin]))[0].r;
 const exactReview=(await q("select count(*)::int n from public.order_pricing_current p join public.customer_orders o on o.id=p.customer_order_id where p.review_required and o.status not in ('delivered','cancelled')"))[0].n;
 assert.equal(reviewHome.pricing_review,exactReview);assert(exactReview>0);
 const reviewIds=(await q("select public.read_admin_review_order_ids(0,20,'') r"))[0].r;assert(reviewIds.includes(order4.order_id));
 await db.exec('reset role');
 const reviewReference=(await q("select reference from public.commerce_references where kind='ORD' and record_id=$1",[order4.order_id]))[0].reference;
 await as(admin);
 assert.deepEqual((await q('select public.read_admin_review_order_ids(0,20,$1) r',[reviewReference]))[0].r,[order4.order_id]);
 await as(customer);await assert.rejects(q("select public.read_admin_review_order_ids(0,20,'')"),/administrator required/);await db.exec('reset role');
 console.log('PASS UI-02 pricing-review count/list consistency, reference search and customer denial');

 assert.equal((await q("select count(*)::int n from public.notifications where user_id=$1 and event_key like $2",[admin,'pricing-review:'+order4.order_id+':%']))[0].n,1);
 await as(customer);await assert.rejects(()=>q('select public.reconcile_push_deliveries()'));await assert.rejects(()=>q('select public.authorize_push_delivery($1,$2)',[crypto.randomUUID(),crypto.randomUUID()]));
 await db.exec('reset role');await q("select set_config('request.jwt.claim.role','service_role',false)");await db.exec('set role service_role');
 await q('select public.reconcile_push_deliveries()');await q('select public.reconcile_push_deliveries()');
 const recovered=(await q('select public.claim_push_deliveries(100) r'))[0].r.find(r=>r.notification_id===n4);assert(recovered,'worker reconciliation repairs missed queue insert');
 assert.equal((await q('select public.authorize_push_delivery($1,$2) ok',[recovered.id,recovered.lease]))[0].ok,true);
 await db.exec('reset role');await q('update public.notifications set read_at=now() where id=$1',[n4]);
 await q("select set_config('request.jwt.claim.role','service_role',false)");await db.exec('set role service_role');assert.equal((await q('select public.authorize_push_delivery($1,$2) ok',[recovered.id,recovered.lease]))[0].ok,false,'already read notification is not pushed');
 await db.exec('reset role');assert.equal((await q('select count(*)::int n from public.push_deliveries where notification_id=$1',[n4]))[0].n,1);
 const legacy=[customer,JSON.stringify({orderId:order4.order_id,url:'/order-details'})];
 for(let i=0;i<2;i++)await q("insert into public.notifications(user_id,type,title,body,data) values($1,'order','حدث مكرر للاختبار','محتوى عام',$2)",legacy);
 assert.equal((await q("select count(*)::int n from public.notifications where user_id=$1 and title='حدث مكرر للاختبار'",[customer]))[0].n,1);
 const offerNotification=(await q("insert into public.notifications(user_id,type,title,body,data) values($1,'offer','عرض','اختبار','{}') returning id",[customer]))[0].id;
 assert.equal((await q('select count(*)::int n from public.push_deliveries where notification_id=$1',[offerNotification]))[0].n,0,'marketing is not automatically pushed');
 await as(customer);assert.equal((await q('select count(*)::int n from public.notifications where user_id=$1',[admin]))[0].n,0,'customer cannot read admin events');await db.exec('reset role');
 console.log('PASS UX-05 admin/application and merchant targeting, event uniqueness, broken Push queue preserves real order, service ACL, reconciliation dedup and last-moment read suppression');
 // Equal timestamps exercise the UUID tie breaker. The inserts are confined to this disposable database.
 await db.exec('reset role');
 await q(`insert into public.money_invoices(reference,kind,owner_id,title,source_key,amount,created_at)
   select 'SAL-9876'||lpad(n::text,3,'0'),'SAL',$1,'test page','page-test:'||n,1,'2099-01-01'
   from generate_series(1,21) n`,[merchant]);
 const merchantPage=async(search,kind,before)=>(
   await q('select public.read_merchant_money($1,$2,$3,$4) as r',
     [search,kind,before?.created_at??null,before?.id??null])
 )[0].r;
 await as(merchant);
 const first=await merchantPage('٩٨٧٦','SAL');
 assert.equal(first.rows.length,10);
 assert.equal(first.has_more,true);
 assert(first.rows.every(row=>row.owner_id===merchant&&row.kind==='SAL'));
 assert.deepEqual(first.rows.map(row=>row.id),first.rows.map(row=>row.id).sort().reverse());
 await db.exec('reset role');
 await q(`insert into public.money_invoices(reference,kind,owner_id,title,source_key,amount,created_at)
   values ('SAL-9876999','SAL',$1,'newer','page-test:newer',1,'2099-02-01')`,[merchant]);
 await as(merchant);
 const second=await merchantPage('9876','SAL',first.rows.at(-1));
 const third=await merchantPage('9876','SAL',second.rows.at(-1));
 assert.equal(second.rows.length,10);
 assert.equal(second.has_more,true);
 assert.equal(third.rows.length,1);
 assert.equal(third.has_more,false);
 assert.equal(new Set([...first.rows,...second.rows,...third.rows].map(row=>row.id)).size,21);
 const none=await merchantPage('9876','SUB');
 assert.equal(none.rows.length,0);
 for(const key of ['receivable','payable','subscription_due','collection_due','account_reference']){
   const current=(await q("select public.read_money('',0,null) as r"))[0].r;
   assert.equal(none[key],current[key]);
   assert.equal(second[key],first[key]);
 }
 await assert.rejects(merchantPage('','DLV'),/invalid invoice filter/);
 await as(merchant2);
 await assert.rejects(q('select public.read_money_invoice($1)',[sub[0].id]), error=>error.code==='42501');
 await assert.rejects(q('select public.read_money_invoice($1)',[crypto.randomUUID()]), error=>error.code==='42501');
 assert.equal((await merchantPage('9876','SAL',first.rows.at(-1))).rows.length,0);
 await as(admin);
 await assert.rejects(merchantPage('','ALL'),/account access denied/);
 await db.exec('reset role; set role anon');
 await assert.rejects(merchantPage('','ALL'),/permission denied/);
 await assert.rejects(driverPage('','ALL'),/permission denied/);
 await as(merchant);
 await assert.rejects(driverPage('','ALL'),/account access denied/);
 await db.exec('reset role');
 const otherDriver=await add('driver',{contact_phone:'0991234567',vehicle_type:'دراجة'});
 await q(`insert into public.money_invoices(reference,kind,owner_id,title,source_key,amount,created_at)
   select 'DLV-8765'||lpad(n::text,3,'0'),'DLV',$1,'driver page','driver-page:'||n,1,'2099-01-01'
   from generate_series(1,21) n`,[driver]);
 await as(otherDriver);assert.equal((await driverPage('8765','ALL')).rows.length,0);
 await as(driver);
 const driverFirst=await driverPage('٨٧٦٥','DLV');
 const driverSecond=await driverPage('8765','DLV',driverFirst.rows.at(-1));
 const driverThird=await driverPage('8765','DLV',driverSecond.rows.at(-1));
 assert.deepEqual([driverFirst.rows.length,driverSecond.rows.length,driverThird.rows.length],[10,10,1]);
 assert.deepEqual([driverFirst.has_more,driverSecond.has_more,driverThird.has_more],[true,true,false]);
 assert.equal(new Set([...driverFirst.rows,...driverSecond.rows,...driverThird.rows].map(row=>row.id)).size,21);
 assert(driverFirst.rows.every(row=>row.owner_id===driver&&row.kind==='DLV'));
 assert.equal((await driverPage('8765','SET')).rows.length,0);
 await assert.rejects(driverPage('','SAL'),/invalid invoice filter/);
 console.log('PASS driver finance exact balances, task reference, server filters, stable cursors and owner/role isolation');
 const searchTasks=(term,view,offset=0)=>q('select * from public.search_driver_task_references($1,$2,$3,10)',[term,view,offset]);
 await as(admin);
 const otherApplication=(await q('select id from public.driver_applications where user_id=$1',[otherDriver]))[0].id;
 await q("select public.review_driver_application($1,'accepted',null)",[otherApplication]);
 await db.exec('reset role');
 await q(`with orders as (
   insert into public.customer_orders(customer_id,recipient_name,contact_phone,delivery_address,delivery_zone_name_snapshot,delivery_fee)
   select $1,'Test recipient','0991234567','Test address','Test zone',0 from generate_series(1,23)
   returning id,order_number
 ), numbered as (
   select id,row_number() over(order by order_number) n from orders
 ), tasks as (
   insert into public.delivery_tasks(customer_order_id,driver_id,status,created_at,accepted_at,delivered_at)
   select id,case when n=23 then $3::uuid else $2::uuid end,
    (case when n=22 then 'delivered' else 'accepted' end)::public.delivery_task_status,
    '2099-01-01','2099-01-01',case when n=22 then '2099-01-02'::timestamptz end
   from numbered returning id,customer_order_id
 )
 insert into public.commerce_references(kind,record_id,reference)
 select 'TSK',tasks.id,'TSK-7654'||lpad(numbered.n::text,3,'0') from tasks join numbered on numbered.id=tasks.customer_order_id`,[customer,driver,otherDriver]);
 await as(driver);
 const firstTasks=await searchTasks('tsk-٧٦٥٤','active');
 const secondTasks=await searchTasks('7654','active',10);
 assert.equal(firstTasks.length,11);assert.equal(secondTasks.length,11);
 assert.equal(new Set([...firstTasks.slice(0,10),...secondTasks].map(row=>row.task_id)).size,21);
 assert.deepEqual(await searchTasks(secondTasks[1].reference,'active'),[secondTasks[1]]);
 assert.deepEqual((await searchTasks('7654','completed')).map(row=>row.reference),['TSK-7654022']);
 assert.equal((await searchTasks('TSK-7654023','active')).length,0);
 await as(otherDriver);assert.deepEqual((await searchTasks('7654','active')).map(row=>row.reference),['TSK-7654023']);
 await as(merchant);await assert.rejects(searchTasks('7654','active'),/driver access denied/);
 await db.exec('reset role; set role anon');await assert.rejects(searchTasks('7654','active'),/permission denied/);
 console.log('PASS driver task search over 21 matches, Arabic digits, later-page exact match, state and owner isolation');
 console.log('PASS merchant invoice search, kind and keyset, ten rows, exact balances, tied timestamps, newer insert, cross-owner and role denial');
 await as(admin);
 const historical=(await q("select id,scope,is_active from public.catalog_categories where slug='historical-disabled'"))[0];
 assert.deepEqual(historical,{id:'10000000-0000-0000-0000-000000000001',scope:'product',is_active:false});
 const makeCategory=async(scope,name,slug,parent=null)=>(await q(
   'insert into public.catalog_categories(scope,name,slug,parent_id) values($1,$2,$3,$4) returning id',
   [scope,name,slug,parent],
 ))[0].id;
 const root=await makeCategory('product','تصنيف اختبار رئيسي','test-root');
 const child=await makeCategory('product','تصنيف اختبار فرعي','test-child',root);
 const otherRoot=await makeCategory('product','رئيسي بديل','test-root-alt');
 const storeRoot=await makeCategory('store','تصنيف متجر اختباري','test-store-root');
 const storeChild=await makeCategory('store','تصنيف متجر فرعي','test-store-child',storeRoot);
 const selectable=async id=>(await q('select id,parent_id from public.selectable_catalog_categories where id=$1',[id]))[0];
 assert.deepEqual(await selectable(storeChild),{id:storeChild,parent_id:storeRoot});
 await db.exec('reset role');
 const signupCategory={contact_phone:'0991234567',store_name:'متجر تصنيف جديد',category_id:storeChild,store_address:'عنوان اختبار',plan_id:plan};
 const categoryMerchant=await add('merchant',signupCategory);
 assert.equal((await q('select category_id from public.merchant_applications where user_id=$1',[categoryMerchant]))[0].category_id,storeChild);
 await as(admin);
 const revision=Number((await q('select revision from public.catalog_category_revision'))[0].revision);
 await q('update public.catalog_categories set is_active=false where id=$1',[storeRoot]);
 assert.equal(await selectable(storeChild),undefined);
 assert.equal(Number((await q('select revision from public.catalog_category_revision'))[0].revision),revision+1);
 await db.exec('reset role');
 await assert.rejects(add('merchant',signupCategory),/active store category required/);
 await as(categoryMerchant);
 assert.equal((await q('select id from public.catalog_categories where id=$1',[storeChild]))[0].id,storeChild);
 assert.equal(await selectable(storeChild),undefined);
 await assert.rejects(q('update public.catalog_category_revision set revision=0'),error=>error.code==='42501');
 await as(admin);
 await q('update public.catalog_categories set is_active=true where id=$1',[storeRoot]);
 const categoryApplication=(await q('select id from public.merchant_applications where user_id=$1',[categoryMerchant]))[0].id;
 await q("select public.review_merchant_application($1,'accepted',null)",[categoryApplication]);
 assert.equal((await q('select s.category_id from public.stores s join public.merchants m on m.id=s.merchant_id where m.owner_user_id=$1',[categoryMerchant]))[0].category_id,storeChild);
 await assert.rejects(makeCategory('store','طفل عبر النطاق','test-cross-scope',root), e=>e.code==='23514');
 await assert.rejects(makeCategory('product','مستوى ثالث','test-third',child), e=>e.code==='23514');
 await assert.rejects(q('update public.catalog_categories set parent_id=id where id=$1',[root]),e=>e.code==='23514');
 await assert.rejects(q('update public.catalog_categories set parent_id=$1 where id=$2',[child,root]),e=>e.code==='23514');
 const restricted=e=>e.code==='23503'||e.code==='23001';
 await assert.rejects(q('delete from public.catalog_categories where id=$1',[root]),restricted);
 await assert.rejects(q('delete from public.catalog_categories where id=$1',[category]),restricted);
 await q("update public.catalog_categories set parent_id=$1,name='فرعي معدل',sort_order=7 where id=$2",[otherRoot,child]);
 const fixture=(await q('select id,category_id from public.products where store_id=$1 limit 1',[store]))[0];
 await as(merchant);
 await assert.rejects(makeCategory('product','ممنوع','test-denied'),e=>e.code==='42501');
 await assert.rejects(q('insert into public.product_categories(name,slug) values($1,$2)',['ممنوع','test-legacy-denied']),e=>e.code==='42501');
 await assert.rejects(q('update public.products set category_id=$1 where id=$2',[storeRoot,fixture.id]),e=>e.code==='23514');
 await q('update public.products set category_id=$1 where id=$2',[child,fixture.id]);
 await as(customer);
 assert.deepEqual(await selectable(child),{id:child,parent_id:otherRoot});
 assert.equal((await q('select category_id from public.products where id=$1',[fixture.id]))[0].category_id,child);
 await as(admin);
 await q('update public.catalog_categories set is_active=false where id=$1',[otherRoot]);
 await assert.rejects(q('delete from public.catalog_categories where id=$1',[child]),restricted);
 await as(merchant);
 assert.equal((await q('select name,sort_order from public.catalog_categories where id=$1',[child]))[0].name,'فرعي معدل');
 await q('update public.products set category_id=category_id where id=$1',[fixture.id]);
 await as(merchant2);
 assert.equal((await q('select id from public.catalog_categories where id=$1',[child])).length,0);
 assert.equal((await q('update public.products set category_id=$1 where id=$2 returning id',[root,fixture.id])).length,0);
 await as(customer);
 assert.equal(await selectable(child),undefined);
 assert.equal((await q('select category_id from public.products where id=$1',[fixture.id]))[0].category_id,child);
 await db.exec('reset role; set role anon');
 assert.equal((await q('select id from public.catalog_categories where id=$1',[child])).length,0);
 assert.equal(await selectable(child),undefined);
 assert.ok((await q('select revision from public.catalog_category_revision')).length);
 await as(admin);
 await q('update public.catalog_categories set is_active=true where id=$1',[otherRoot]);
 assert.deepEqual(await selectable(child),{id:child,parent_id:otherRoot});
 await as(merchant);
 assert.equal((await q('select is_active from public.product_categories where id=$1',[child]))[0].is_active,true);
 await q('update public.products set category_id=$1 where id=$2',[fixture.category_id,fixture.id]);
 await as(admin);
 await q('delete from public.catalog_categories where id=$1',[child]);
 assert.equal((await q('select id from public.product_categories where id=$1',[child])).length,0);
 await db.exec('reset role');
 const verification=await db.exec(fs.readFileSync('supabase/verification/central_catalog_categories_readonly.sql','utf8'));
 assert.deepEqual(Object.values(verification[1].rows[0]).map(Number),[0,0,0]);
 assert.equal(Number(verification[2].rows[0].mirror_mismatches),0);
 const consumers=await db.exec(fs.readFileSync('supabase/verification/central_category_consumers_readonly.sql','utf8'));
 assert.equal(Number(consumers[0].rows[0].selectable_mismatches),0);
 assert.deepEqual(Object.values(consumers[1].rows[0]),[true,true,true]);
 console.log('PASS central categories: two levels, scope, reparent, inherited activation, protected references, admin and owner RLS');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message,e.detail??'');process.exitCode=1;});
