-- Subscription-plan management guard.
-- Plans can remain inactive as drafts, but an active plan must be complete
-- enough to be safely presented and selected in a merchant application.

begin;

create or replace function public.validate_active_subscription_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_active then
    return new;
  end if;

  if nullif(trim(new.description), '') is null then
    raise exception 'an active subscription plan requires a description';
  end if;
  if new.commission_rate is null
     or new.commission_rate::text in ('NaN', 'Infinity', '-Infinity')
     or new.commission_rate < 0
     or new.commission_rate > 100 then
    raise exception 'an active subscription plan requires a commission rate from 0 to 100';
  end if;
  if new.product_limit is null or new.product_limit < 0 then
    raise exception 'an active subscription plan requires a non-negative product limit';
  end if;
  if new.features is null
     or jsonb_typeof(new.features) <> 'array'
     or jsonb_array_length(new.features) = 0
     or exists (
       select 1
       from jsonb_array_elements(new.features) as feature(value)
       where jsonb_typeof(feature.value) <> 'string'
          or nullif(trim(feature.value #>> '{}'), '') is null
     ) then
    raise exception 'an active subscription plan requires at least one non-empty feature';
  end if;

  return new;
end;
$$;

drop trigger if exists subscription_plans_validate_active_configuration
  on public.subscription_plans;
create trigger subscription_plans_validate_active_configuration
  before insert or update of is_active, description, commission_rate, product_limit, features
  on public.subscription_plans
  for each row execute function public.validate_active_subscription_plan();

revoke all on function public.validate_active_subscription_plan()
  from public, anon, authenticated;

commit;
