-- Requires MIG-001 and MIG-002. No reset or data deletion.
-- Merchant selects an active complete plan; server snapshots terms atomically.
-- Existing pending requests without a plan retain the same MAP on completion.
begin;
create or replace function onboarding_private.save_application(owner_id uuid, payload jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  profile_row public.profiles%rowtype;
  phone_value text:=trim(coalesce(payload->>'contact_phone',''));
  store_value text:=trim(coalesce(payload->>'store_name',''));
  address_value text:=trim(coalesce(payload->>'store_address',''));
  vehicle_value text:=trim(coalesce(payload->>'vehicle_type',''));
  category_value uuid;
  plan_row public.subscription_plans%rowtype;
  plan_value uuid;
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
    if found and (state_value='accepted' or (state_value='pending' and exists(select 1 from public.merchant_applications where user_id=owner_id and plan_id is not null))) then return reference_value; end if;
    begin plan_value:=(payload->>'plan_id')::uuid; exception when invalid_text_representation then raise exception 'valid subscription plan required'; end;
    select * into plan_row from public.subscription_plans where id=plan_value and is_active
      and commission_rate is not null and product_limit is not null and jsonb_typeof(features)='array' for share;
    if not found then raise exception 'complete active subscription plan required'; end if;
    insert into public.merchant_applications(user_id,contact_phone,store_name,store_description,store_address,category_id,plan_id,plan_name_snapshot,plan_duration_months_snapshot,plan_price_snapshot,plan_currency_snapshot,plan_commission_rate_snapshot,plan_product_limit_snapshot,plan_features_snapshot)
    values(owner_id,phone_value,store_value,'',address_value,category_value,plan_row.id,plan_row.name,plan_row.duration_months,plan_row.price,'SYP',plan_row.commission_rate,plan_row.product_limit,plan_row.features)
    on conflict(user_id) do update set contact_phone=excluded.contact_phone,
      store_name=excluded.store_name,store_address=excluded.store_address,category_id=excluded.category_id,
      plan_id=excluded.plan_id,plan_name_snapshot=excluded.plan_name_snapshot,plan_duration_months_snapshot=excluded.plan_duration_months_snapshot,
      plan_price_snapshot=excluded.plan_price_snapshot,plan_currency_snapshot=excluded.plan_currency_snapshot,
      plan_commission_rate_snapshot=excluded.plan_commission_rate_snapshot,plan_product_limit_snapshot=excluded.plan_product_limit_snapshot,plan_features_snapshot=excluded.plan_features_snapshot,
      status='pending',review_note=null,reviewed_by=null,reviewed_at=null,submitted_at=now()
    where public.merchant_applications.status in ('rejected','changes_requested') or (public.merchant_applications.status='pending' and public.merchant_applications.plan_id is null)
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
  if coalesce(new.raw_user_meta_data->>'onboarding_version','')<>'3' then raise exception 'updated signup flow required'; end if;
  if new.raw_user_meta_data->>'signup_role' in ('customer','merchant','driver') then
    selected_role:=(new.raw_user_meta_data->>'signup_role')::public.account_role;
  end if;
  name_value:=trim(coalesce(new.raw_user_meta_data->>'full_name','مستخدم'));
  if new.raw_user_meta_data->>'onboarding_version'='3' then
    if coalesce(new.raw_user_meta_data->>'signup_role','') not in ('customer','merchant','driver') then raise exception 'valid signup role required'; end if;
    if coalesce(new.raw_user_meta_data->>'signup_birth_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'birth date required'; end if;
    begin birth_value:=(new.raw_user_meta_data->>'signup_birth_date')::date; exception when datetime_field_overflow or invalid_datetime_format then raise exception 'invalid birth date'; end;
    if birth_value is null or birth_value>=current_date then raise exception 'past birth date required'; end if;
  end if;
  insert into public.profiles(id,email,full_name,role,birth_date)
  values(new.id,coalesce(new.email,''),name_value,selected_role,birth_value);
  if new.raw_user_meta_data->>'onboarding_version'='3' and selected_role in ('merchant','driver') then
    perform onboarding_private.save_application(new.id,new.raw_user_meta_data->'signup_application');
  end if;
  -- Keep DOB, address and professional request out of auth metadata/JWT after ingestion.
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)
    -'signup_birth_date'-'signup_application'-'signup_age_range'-'signup_gender'
  where id=new.id;
  return new;
end;
$$;

create or replace function public.submit_professional_onboarding(input_application jsonb,input_birth_date date) returns text
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid:=auth.uid(); result_value text;
begin
  if owner_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if input_birth_date is null or input_birth_date<date '0001-01-01' or input_birth_date>=current_date then raise exception 'past birth date required'; end if;
  perform 1 from public.profiles where id=owner_id and role in ('merchant','driver') for update;
  if not found then raise exception 'professional account required' using errcode='42501'; end if;
  -- Do not mutate an already submitted/approved account as a side effect of retry.
  select public_reference into result_value from public.merchant_applications where user_id=owner_id and (status='accepted' or (status='pending' and plan_id is not null));
  if not found then select public_reference into result_value from public.driver_applications where user_id=owner_id and status in ('pending','accepted'); end if;
  if result_value is not null then return result_value; end if;
  update public.profiles set birth_date=input_birth_date where id=owner_id;
  return onboarding_private.save_application(owner_id,input_application);
end;
$$;
revoke all on function public.submit_professional_onboarding(jsonb,date) from public,anon;
grant execute on function public.submit_professional_onboarding(jsonb,date) to authenticated;

create or replace function public.get_signup_capabilities() returns integer
language sql stable set search_path = '' as $$ select 3 $$;
-- Administrators review the merchant selection instead of substituting another plan.
revoke execute on function public.assign_application_plan(uuid,uuid) from authenticated;
commit;
