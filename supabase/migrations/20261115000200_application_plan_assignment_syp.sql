-- Fix MIG-001's administrative assignment after the SYP-only schema removed
-- subscription_plans.currency. Existing invoices, payments and plans are untouched.
-- Requires 20261115000100_essential_role_first_onboarding.sql.
begin;
create or replace function public.assign_application_plan(target_application uuid,selected_plan uuid) returns void
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
    plan_currency_snapshot='SYP',plan_commission_rate_snapshot=plan_row.commission_rate,
    plan_product_limit_snapshot=plan_row.product_limit,plan_features_snapshot=plan_row.features
  where id=target_application;
end;
$$;
revoke all on function public.assign_application_plan(uuid,uuid) from public,anon;
grant execute on function public.assign_application_plan(uuid,uuid) to authenticated;
commit;
