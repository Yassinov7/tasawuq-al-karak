-- Manual STAGING test after 014. Nothing here is executed by the agent.
-- Clone the DEPLOYED view expression over temporary fixtures, rather than
-- testing a second hand-written implementation of the custody calculation.
-- Only pg_temp receives data; no real deliveries/remittances/payouts are made.
begin;
set local search_path = pg_catalog;

create temporary table customer_order_cash_obligations(driver_id uuid, currency public.currency_code, collectible_amount numeric);
create temporary table driver_delivery_fee_entitlements(driver_id uuid, currency public.currency_code, delivery_fee_amount numeric);
create temporary table driver_cash_remittances(driver_id uuid, currency public.currency_code, amount numeric);
create temporary table driver_cash_credit_payouts(driver_id uuid, currency public.currency_code, amount numeric);

do $$
declare definition text; relation_name text;
begin
  -- With only pg_catalog in search_path, pg_get_viewdef qualifies all public
  -- sources. Replace only the four reviewed relations with their temp copies.
  definition := pg_get_viewdef('public.driver_cash_custody_positions'::regclass, false);
  foreach relation_name in array array['customer_order_cash_obligations', 'driver_delivery_fee_entitlements',
    'driver_cash_remittances', 'driver_cash_credit_payouts'] loop
    definition := replace(definition, 'public.' || relation_name, 'pg_temp.' || relation_name);
  end loop;
  if position('public.' in definition) > 0 then raise exception 'unreviewed public dependency in deployed view'; end if;
  execute 'create temporary view tested_driver_cash_custody_positions as ' || definition;
end;
$$;

insert into pg_temp.customer_order_cash_obligations values
  ('00000000-0000-4000-8000-000000000001', 'SYP', 110),
  ('00000000-0000-4000-8000-000000000002', 'SYP', 220),
  ('00000000-0000-4000-8000-000000000003', 'SYP', 110),
  ('00000000-0000-4000-8000-000000000004', 'SYP', 110),
  ('00000000-0000-4000-8000-000000000005', 'SYP', 110),
  ('00000000-0000-4000-8000-000000000007', 'SYP', 110);
insert into pg_temp.driver_delivery_fee_entitlements values
  ('00000000-0000-4000-8000-000000000001', 'SYP', 10),
  ('00000000-0000-4000-8000-000000000002', 'SYP', 20),
  ('00000000-0000-4000-8000-000000000003', 'SYP', 10),
  ('00000000-0000-4000-8000-000000000004', 'SYP', 10),
  ('00000000-0000-4000-8000-000000000005', 'SYP', 10),
  ('00000000-0000-4000-8000-000000000007', 'SYP', 10);
insert into pg_temp.driver_cash_remittances values
  ('00000000-0000-4000-8000-000000000001', 'SYP', 150),
  ('00000000-0000-4000-8000-000000000002', 'SYP', 150),
  ('00000000-0000-4000-8000-000000000003', 'SYP', 100),
  ('00000000-0000-4000-8000-000000000004', 'SYP', 150),
  ('00000000-0000-4000-8000-000000000005', 'SYP', 60),
  ('00000000-0000-4000-8000-000000000006', 'SYP', 100),
  ('00000000-0000-4000-8000-000000000007', 'SYP', 100);
insert into pg_temp.driver_cash_credit_payouts values
  ('00000000-0000-4000-8000-000000000001', 'SYP', 50),
  ('00000000-0000-4000-8000-000000000002', 'SYP', 50),
  ('00000000-0000-4000-8000-000000000003', 'SYP', 100),
  ('00000000-0000-4000-8000-000000000004', 'SYP', 20),
  ('00000000-0000-4000-8000-000000000006', 'SYP', 100);

do $$
begin
  if (select count(*) from pg_temp.tested_driver_cash_custody_positions) <> 7 then raise exception 'missing/extra driver positions'; end if;
  if exists(
    select 1 from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'SYP'::public.currency_code, 0, 0),
      -- Old expression wrongly returned 50 instead of 100 after credit refund.
      ('00000000-0000-4000-8000-000000000002'::uuid, 'SYP'::public.currency_code, 100, 0),
      -- An advance was fully refunded, then a later delivery became due.
      ('00000000-0000-4000-8000-000000000003'::uuid, 'SYP'::public.currency_code, 100, 0),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'SYP'::public.currency_code, 0, 30),
      ('00000000-0000-4000-8000-000000000005'::uuid, 'SYP'::public.currency_code, 40, 0),
      ('00000000-0000-4000-8000-000000000006'::uuid, 'SYP'::public.currency_code, 0, 0),
      ('00000000-0000-4000-8000-000000000007'::uuid, 'SYP'::public.currency_code, 0, 0)
    ) expected(driver_id, currency, remaining, credit)
    left join pg_temp.tested_driver_cash_custody_positions actual using(driver_id, currency)
    where actual.custody_remaining_amount is distinct from expected.remaining
      or actual.driver_credit_amount is distinct from expected.credit
  ) then raise exception 'driver custody/refunded-credit regression'; end if;
end;
$$;
rollback;
