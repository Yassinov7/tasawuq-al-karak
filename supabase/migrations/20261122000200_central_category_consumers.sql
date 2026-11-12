-- Requires 20261122000100_central_catalog_categories.sql.
-- Keep compatibility mirrors and existing foreign keys; switch reads and onboarding to the central tree.
begin;

create function public.catalog_category_is_selectable(input_scope text, input_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.catalog_categories c
    left join public.catalog_categories p on p.id=c.parent_id and p.scope=c.scope
    where c.scope=input_scope and c.id=input_id and c.is_active
      and (c.parent_id is null or p.is_active)
  );
$$;
revoke all on function public.catalog_category_is_selectable(text,uuid) from public;
grant execute on function public.catalog_category_is_selectable(text,uuid) to anon,authenticated;

alter policy catalog_categories_read_active on public.catalog_categories
  using (public.catalog_category_is_selectable(scope,id));

-- Active choices for every role, including admins and owners who can read disabled records.
create view public.selectable_catalog_categories with (security_invoker=true) as
select id,scope,parent_id,name,slug,sort_order
from public.catalog_categories
where public.catalog_category_is_selectable(scope,id);
revoke all on public.selectable_catalog_categories from public,anon,authenticated;
grant select on public.selectable_catalog_categories to anon,authenticated;

-- A public invalidation event without category IDs or labels. Disabled/deleted rows
-- are not visible under public RLS, so listening to the category rows would miss them.
create table public.catalog_category_revision (
  id smallint primary key check (id=1),
  revision bigint not null default 0
);
insert into public.catalog_category_revision(id) values (1);
alter table public.catalog_category_revision enable row level security;
create policy catalog_category_revision_read on public.catalog_category_revision
  for select to anon,authenticated using (true);
revoke all on public.catalog_category_revision from public,anon,authenticated;
grant select on public.catalog_category_revision to anon,authenticated;
create function category_private.bump_catalog_category_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.catalog_category_revision set revision=revision+1 where id=1;
  return null;
end;
$$;
revoke all on function category_private.bump_catalog_category_revision() from public,anon,authenticated;
create trigger catalog_category_revision_changed
  after insert or update or delete on public.catalog_categories
  for each statement execute function category_private.bump_catalog_category_revision();
alter publication supabase_realtime add table public.catalog_category_revision;

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
    select status,public_reference into state_value,reference_value from public.merchant_applications where user_id=owner_id for update;
    if found and (state_value='accepted' or (state_value='pending' and exists(select 1 from public.merchant_applications where user_id=owner_id and plan_id is not null))) then return reference_value; end if;
    -- Only new assignments need an active category. The assignment trigger also checks writes.
    if not exists (
      select 1 from public.merchant_applications where user_id=owner_id and category_id=category_value
    ) then
      perform 1 from category_private.tree_guard where scope='store' for share;
      if not public.catalog_category_is_selectable('store',category_value) then
        raise exception 'active store category required';
      end if;
    end if;
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

commit;
