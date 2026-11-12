-- Role-first signup: personal details and complete pending application are saved
-- in the same auth.users INSERT transaction. No merchant/driver approval or billing.
begin;

alter table public.profiles add column birth_date date;
alter table public.profiles add constraint profiles_birth_date_past check (birth_date is null or birth_date < current_date);
comment on column public.profiles.birth_date is 'Self-reported calendar birth date; private profile information, not verified identity.';

-- Commercial/work terms belong to review, not an applicant's required identity data.
alter table public.merchant_applications
  alter column plan_id drop not null,
  alter column plan_name_snapshot drop not null,
  alter column plan_duration_months_snapshot drop not null,
  alter column plan_price_snapshot drop not null,
  alter column plan_currency_snapshot drop not null;
alter table public.driver_applications alter column contract_duration_months drop not null;

create schema onboarding_private;
revoke all on schema onboarding_private from public, anon, authenticated;
create sequence onboarding_private.merchant_application_number;
create sequence onboarding_private.driver_application_number;

-- Fixed minimum width, never truncates a sequence beyond seven digits.
create function onboarding_private.application_reference(kind text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare n text;
begin
  if kind='MAP' then n:=nextval('onboarding_private.merchant_application_number')::text;
  elsif kind='DAP' then n:=nextval('onboarding_private.driver_application_number')::text;
  else raise exception 'unsupported application reference'; end if;
  return kind||'-'||repeat('0',greatest(0,7-length(n)))||n;
end;
$$;
alter table public.merchant_applications add column public_reference text not null default onboarding_private.application_reference('MAP') unique;
alter table public.driver_applications add column public_reference text not null default onboarding_private.application_reference('DAP') unique;

create function onboarding_private.save_application(owner_id uuid, payload jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  profile_row public.profiles%rowtype;
  phone_value text:=trim(coalesce(payload->>'contact_phone',''));
  store_value text:=trim(coalesce(payload->>'store_name',''));
  address_value text:=trim(coalesce(payload->>'store_address',''));
  vehicle_value text:=trim(coalesce(payload->>'vehicle_type',''));
  category_value uuid;
  reference_value text;
  state_value public.application_status;
begin
  select * into strict profile_row from public.profiles where id=owner_id for update;
  if profile_row.role not in ('merchant','driver') then raise exception 'professional account required'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or phone_value !~ '^\+?[0-9]{7,15}$' then raise exception 'valid professional contact required'; end if;
  if profile_row.role='merchant' then
    if exists(select 1 from public.merchants where owner_user_id=owner_id) then raise exception 'merchant already approved'; end if;
    if length(store_value) not between 2 and 120 or length(address_value) not between 3 and 300 then raise exception 'store name and address required'; end if;
    begin category_value:=(payload->>'category_id')::uuid; exception when invalid_text_representation then raise exception 'valid category required'; end;
    perform 1 from public.store_categories where id=category_value and is_active for share;
    if not found then raise exception 'active store category required'; end if;
    select status,public_reference into state_value,reference_value from public.merchant_applications where user_id=owner_id for update;
    if found and state_value in ('pending','accepted') then return reference_value; end if;
    insert into public.merchant_applications(user_id,contact_phone,store_name,store_description,store_address,category_id)
    values(owner_id,phone_value,store_value,'',address_value,category_value)
    on conflict(user_id) do update set contact_phone=excluded.contact_phone,
      store_name=excluded.store_name,store_address=excluded.store_address,category_id=excluded.category_id,
      status='pending',review_note=null,reviewed_by=null,reviewed_at=null,submitted_at=now()
    where public.merchant_applications.status in ('rejected','changes_requested')
    returning public_reference into reference_value;
  else
    if length(vehicle_value) not between 2 and 80 then raise exception 'vehicle required'; end if;
    select status,public_reference into state_value,reference_value from public.driver_applications where user_id=owner_id for update;
    if found and state_value in ('pending','accepted') then return reference_value; end if;
    insert into public.driver_applications(user_id,full_name,contact_phone,vehicle_type,contract_duration_months,available_hours)
    values(owner_id,profile_row.full_name,phone_value,vehicle_value,null,'{}'::jsonb)
    on conflict(user_id) do update set full_name=excluded.full_name,contact_phone=excluded.contact_phone,
      vehicle_type=excluded.vehicle_type,status='pending',review_note=null,reviewed_by=null,reviewed_at=null,submitted_at=now()
    where public.driver_applications.status in ('rejected','changes_requested')
    returning public_reference into reference_value;
  end if;
  if reference_value is null then raise exception 'application could not be saved'; end if;
  return reference_value;
end;
$$;

create or replace function public.create_profile_for_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare selected_role public.account_role:='customer'; birth_value date; name_value text;
begin
  if coalesce(new.raw_user_meta_data->>'onboarding_version','')<>'2' then raise exception 'updated signup flow required'; end if;
  if new.raw_user_meta_data->>'signup_role' in ('customer','merchant','driver') then
    selected_role:=(new.raw_user_meta_data->>'signup_role')::public.account_role;
  end if;
  name_value:=trim(coalesce(new.raw_user_meta_data->>'full_name','مستخدم'));
  if new.raw_user_meta_data->>'onboarding_version'='2' then
    if coalesce(new.raw_user_meta_data->>'signup_role','') not in ('customer','merchant','driver') then raise exception 'valid signup role required'; end if;
    if coalesce(new.raw_user_meta_data->>'signup_birth_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'birth date required'; end if;
    begin birth_value:=(new.raw_user_meta_data->>'signup_birth_date')::date; exception when datetime_field_overflow or invalid_datetime_format then raise exception 'invalid birth date'; end;
    if birth_value is null or birth_value>=current_date then raise exception 'past birth date required'; end if;
  end if;
  insert into public.profiles(id,email,full_name,role,birth_date)
  values(new.id,coalesce(new.email,''),name_value,selected_role,birth_value);
  if new.raw_user_meta_data->>'onboarding_version'='2' and selected_role in ('merchant','driver') then
    perform onboarding_private.save_application(new.id,new.raw_user_meta_data->'signup_application');
  end if;
  -- Keep DOB, address and professional request out of auth metadata/JWT after ingestion.
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)
    -'signup_birth_date'-'signup_application'-'signup_age_range'-'signup_gender'
  where id=new.id;
  return new;
end;
$$;

create function public.get_signup_capabilities() returns integer
language sql stable set search_path = '' as $$ select 2 $$;
revoke all on function public.get_signup_capabilities() from public;
grant execute on function public.get_signup_capabilities() to anon,authenticated;

-- Existing incomplete/rejected accounts reuse the same field contract, never a new role.
create function public.submit_professional_onboarding(input_application jsonb,input_birth_date date) returns text
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid:=auth.uid(); result_value text;
begin
  if owner_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if input_birth_date is null or input_birth_date<date '0001-01-01' or input_birth_date>=current_date then raise exception 'past birth date required'; end if;
  perform 1 from public.profiles where id=owner_id and role in ('merchant','driver') for update;
  if not found then raise exception 'professional account required' using errcode='42501'; end if;
  -- Do not mutate an already submitted/approved account as a side effect of retry.
  select public_reference into result_value from public.merchant_applications where user_id=owner_id and status in ('pending','accepted');
  if not found then select public_reference into result_value from public.driver_applications where user_id=owner_id and status in ('pending','accepted'); end if;
  if result_value is not null then return result_value; end if;
  update public.profiles set birth_date=input_birth_date where id=owner_id;
  return onboarding_private.save_application(owner_id,input_application);
end;
$$;
revoke all on function public.submit_professional_onboarding(jsonb,date) from public,anon;
grant execute on function public.submit_professional_onboarding(jsonb,date) to authenticated;

-- Compatibility boundary for the current approval writer until financial replacement:
-- administrators choose commercial terms; applicants never invent or select a contract.
create function public.assign_application_plan(target_application uuid,selected_plan uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare plan_row public.subscription_plans%rowtype;
begin
  if not public.is_admin() then raise exception 'administrator required' using errcode='42501'; end if;
  perform 1 from public.merchant_applications where id=target_application and status<>'accepted' for update;
  if not found then raise exception 'application not available for review'; end if;
  select * into plan_row from public.subscription_plans where id=selected_plan and is_active
    and commission_rate is not null and product_limit is not null and jsonb_typeof(features)='array' for share;
  if not found then raise exception 'complete active subscription plan required'; end if;
  update public.merchant_applications set plan_id=plan_row.id,plan_name_snapshot=plan_row.name,
    plan_duration_months_snapshot=plan_row.duration_months,plan_price_snapshot=plan_row.price,
    plan_currency_snapshot=plan_row.currency,plan_commission_rate_snapshot=plan_row.commission_rate,
    plan_product_limit_snapshot=plan_row.product_limit,plan_features_snapshot=plan_row.features
  where id=target_application;
end;
$$;
revoke all on function public.assign_application_plan(uuid,uuid) from public,anon;
grant execute on function public.assign_application_plan(uuid,uuid) to authenticated;
revoke all on all functions in schema onboarding_private from public,anon,authenticated;
revoke all on all sequences in schema onboarding_private from public,anon,authenticated;

commit;
