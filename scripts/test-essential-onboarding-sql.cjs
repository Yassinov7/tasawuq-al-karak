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
 for(const file of files){try{await db.exec(fs.readFileSync(path.join('supabase/migrations',file),'utf8'));}catch(e){throw Error('Migration '+file+': '+e.message);}}
 console.log('PASS '+files.length+' migrations on synthetic PostgreSQL baseline');count++;
 const q=async(s,p=[])=> (await db.query(s,p)).rows;
 const category=(await q('select id from public.store_categories where is_active limit 1'))[0].id;
 const meta=(role,extra={})=>({onboarding_version:3,signup_role:role,full_name:'اسم تجريبي',signup_birth_date:'1995-06-15',...extra});
 const add=async(metadata)=> (await q('insert into auth.users(email,raw_user_meta_data) values($1,$2) returning id',['onboarding@example.test',JSON.stringify(metadata)]))[0].id;
 const plan=(await q("insert into public.subscription_plans(name,description,duration_months,price,commission_rate,product_limit,features,is_active) values('خطة اختبار','شروط اصطناعية للاختبار',1,20000,10,100,'[\"ميزة اختبار\"]'::jsonb,true) returning id"))[0].id;
 const customer=await add(meta('customer'));
 assert.equal((await q('select birth_date::text from public.profiles where id=$1',[customer]))[0].birth_date,'1995-06-15');
 const merchant=await add(meta('merchant',{signup_application:{contact_phone:'0991234567',store_name:'متجر تجريبي',category_id:category,store_address:'الشارع الرئيسي',plan_id:plan}}));
 const driver=await add(meta('driver',{signup_application:{contact_phone:'0991234568',vehicle_type:'دراجة نارية'}}));
 const m=(await q('select * from public.merchant_applications where user_id=$1',[merchant]))[0],d=(await q('select * from public.driver_applications where user_id=$1',[driver]))[0];
 assert.match(m.public_reference,/^MAP-\d{7,}$/);assert.match(d.public_reference,/^DAP-\d{7,}$/);
 assert.equal(m.status,'pending');assert.equal(m.plan_id,plan);assert.equal(Number(m.plan_price_snapshot),20000);assert.equal(m.plan_currency_snapshot,'SYP');assert.equal(d.contract_duration_months,null);assert.deepEqual(d.available_hours,{});count++;
 console.log('PASS all roles: DOB, complete pending applications, no invented commercial/work terms');
 for(const bad of [meta('admin'),meta('merchant'),meta('merchant',{signup_application:{contact_phone:'0991234567',store_name:'متجر',category_id:category,store_address:'الشارع الرئيسي'}}),meta('merchant',{signup_application:{contact_phone:'0991234567',store_name:'متجر',category_id:category,store_address:'الشارع الرئيسي',plan_id:'11111111-1111-4111-8111-111111111111'}}),meta('driver',{signup_application:{contact_phone:'bad',vehicle_type:'دراجة'}}),meta('customer',{signup_birth_date:'2025-02-30'}),meta('customer',{signup_birth_date:'2999-01-01'})]){
  const before=(await q('select count(*)::int as n from auth.users'))[0].n;
  await assert.rejects(()=>add(bad));assert.equal((await q('select count(*)::int as n from auth.users'))[0].n,before);
 }
 console.log('PASS invalid payloads roll back the entire auth/profile/application insertion');count++;
 const stored=(await q('select raw_user_meta_data from auth.users where id=$1',[merchant]))[0].raw_user_meta_data;
 assert(!('signup_birth_date'in stored));assert(!('signup_application'in stored));count++;
 console.log('PASS sensitive onboarding payload removed from persisted auth metadata');
 await q("select set_config('request.jwt.claim.sub',$1,false)",[merchant]);
 const result=(await q('select public.submit_professional_onboarding($1,$2) as ref',[JSON.stringify({contact_phone:'0991234567',store_name:'متجر تجريبي',category_id:category,store_address:'الشارع الرئيسي',plan_id:plan}),'1995-06-15']))[0].ref;
 assert.equal(result,m.public_reference);assert.equal((await q('select count(*)::int as n from public.merchant_applications where user_id=$1',[merchant]))[0].n,1);count++;
 console.log('PASS retry returns the existing application/reference without duplicates');
 await db.exec('set role authenticated');
 await assert.rejects(()=>q('select onboarding_private.save_application($1,$2)',[driver,'{}']));
 await assert.rejects(()=>q('select public.assign_application_plan($1,gen_random_uuid())',[m.id]));
 assert.equal((await q('select count(*)::int as n from public.merchant_applications where user_id=$1',[driver]))[0].n,0);
 assert.equal((await q('select count(*)::int as n from public.profiles where id=$1',[customer]))[0].n,0);count++;
 console.log('PASS role simulation: private helper and admin assignment denied, other profile hidden');
 await db.exec('reset role');
 const admin=await add(meta('customer'));
 await q("update public.profiles set role='admin' where id=$1",[admin]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
 await db.exec('set role authenticated');
 await assert.rejects(()=>q('select public.assign_application_plan($1,$2)',[m.id,plan]));
 await q("select public.review_merchant_application($1,'accepted',null)",[m.id]);
 assert.equal((await q('select status,public_reference from public.merchant_applications where id=$1',[m.id]))[0].status,'accepted');
 assert.equal((await q('select count(*)::int as n from public.merchants where owner_user_id=$1',[merchant]))[0].n,1);
 count++;console.log('PASS admin approval: merchant-selected plan permits approval; administrators cannot substitute a plan');
 await db.exec('reset role');
 const legacy=await add(meta('merchant',{signup_application:{contact_phone:'0991234567',store_name:'متجر قديم',category_id:category,store_address:'الشارع الرئيسي',plan_id:plan}}));
 const old=(await q('select id,public_reference from public.merchant_applications where user_id=$1',[legacy]))[0];
 await q("update public.merchant_applications set plan_id=null where id=$1",[old.id]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[legacy]);
 await db.exec('set role authenticated');
 const completed=(await q('select public.submit_professional_onboarding($1,$2) as ref',[JSON.stringify({contact_phone:'0991234567',store_name:'متجر تجريبي',category_id:category,store_address:'الشارع الرئيسي',plan_id:plan}),'1995-06-15']))[0].ref;
 assert.equal(completed,old.public_reference);
 assert.equal((await q('select plan_id from public.merchant_applications where id=$1',[old.id]))[0].plan_id,plan);
 await db.exec('reset role');
 count++;console.log('PASS legacy pending merchant selects plan with the same MAP');
 await db.exec("select setval('onboarding_private.merchant_application_number',10000000)");
 assert.equal((await q("select onboarding_private.application_reference('MAP') as ref"))[0].ref,'MAP-10000001');count++;
 console.log('PASS reference expands beyond seven digits without truncation');
 console.log(count+' isolated PostgreSQL checks PASS; signed JWT/API/device/concurrency NOT tested.');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
