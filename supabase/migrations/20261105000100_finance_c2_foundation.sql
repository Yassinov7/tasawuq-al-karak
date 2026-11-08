-- C2 is dormant infrastructure. No existing RPC, table, or trigger is replaced.
begin;

create schema finance_private;
revoke all on schema finance_private from public, anon, authenticated, service_role;

-- Separate sequences intentionally permit gaps after rolled-back transactions.
do $$
declare kind text;
begin
  foreach kind in array array['ORD','SUB','INV','DLV','SET','TXN','RCT','PAY','ADJ','MSB','SIN'] loop
    execute format('create sequence finance_private.%I as bigint minvalue 1 no cycle', lower(kind) || '_reference_seq');
  end loop;
end;
$$;

create function finance_private.next_reference(kind text)
returns table(reference_number bigint, public_reference text)
language plpgsql security definer set search_path = '' as $$
declare number_value bigint; digits text;
begin
  if kind is null or kind <> all(array['ORD','SUB','INV','DLV','SET','TXN','RCT','PAY','ADJ','MSB','SIN']) then
    raise exception 'unsupported reference kind';
  end if;
  number_value := nextval(format('finance_private.%I', lower(kind) || '_reference_seq')::regclass);
  digits := number_value::text;
  return query select number_value, kind || '-' || lpad(digits, greatest(6, length(digits)), '0');
end;
$$;

create table public.financial_document_references (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ORD','SUB','INV','DLV','SET','TXN','RCT','PAY','ADJ','MSB','SIN')),
  document_id uuid not null,
  reference_number bigint not null check (reference_number > 0),
  public_reference text not null unique,
  customer_order_id uuid references public.customer_orders(id) on delete restrict,
  store_order_id uuid references public.store_orders(id) on delete restrict,
  delivery_task_id uuid references public.delivery_tasks(id) on delete restrict,
  subscription_id uuid references public.merchant_subscriptions(id) on delete restrict,
  subscription_invoice_id uuid references public.subscription_invoices(id) on delete restrict,
  journal_entry_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  unique (kind, document_id),
  unique (kind, reference_number),
  check (num_nonnulls(customer_order_id, store_order_id, delivery_task_id,
    subscription_id, subscription_invoice_id, journal_entry_id) = 1),
  check (case kind
    when 'ORD' then customer_order_id = document_id and customer_order_id is not null
    when 'SUB' then store_order_id = document_id and store_order_id is not null
    when 'DLV' then delivery_task_id = document_id and delivery_task_id is not null
    when 'MSB' then subscription_id = document_id and subscription_id is not null
    when 'SIN' then subscription_invoice_id = document_id and subscription_invoice_id is not null
    when 'TXN' then journal_entry_id = document_id and journal_entry_id is not null
    else false end)
);

create function finance_private.assign_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Ignore caller-supplied numbering, including privileged accidental input.
  select r.reference_number, r.public_reference into new.reference_number, new.public_reference
  from finance_private.next_reference(new.kind) r;
  new.created_at := clock_timestamp();
  return new;
end;
$$;
create trigger financial_document_reference_assign before insert on public.financial_document_references
for each row execute function finance_private.assign_reference();

create function finance_private.reject_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'immutable foundation record' using errcode = '55000';
end;
$$;
create trigger financial_document_reference_immutable before update or delete on public.financial_document_references
for each row execute function finance_private.reject_mutation();

create function finance_private.register_document(kind_value text, target_document uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result_id uuid;
begin
  if kind_value not in ('ORD','SUB','DLV','MSB','SIN') or kind_value is null then
    raise exception 'document adapter is not installed';
  end if;
  insert into public.financial_document_references(kind, document_id,
    customer_order_id, store_order_id, delivery_task_id, subscription_id, subscription_invoice_id)
  values (kind_value, target_document,
    case when kind_value = 'ORD' then target_document end,
    case when kind_value = 'SUB' then target_document end,
    case when kind_value = 'DLV' then target_document end,
    case when kind_value = 'MSB' then target_document end,
    case when kind_value = 'SIN' then target_document end)
  on conflict (kind, document_id) do nothing returning id into result_id;
  if result_id is null then
    select id into strict result_id from public.financial_document_references
    where kind = kind_value and document_id = target_document;
  end if;
  return result_id;
end;
$$;

create table public.financial_account_definitions (
  code text primary key,
  name_ar text not null,
  account_type text not null check (account_type in ('asset','liability','income','expense')),
  owner_kind text not null check (owner_kind in ('system','merchant','driver','customer'))
);
insert into public.financial_account_definitions values
  ('driver_cash','عهدة نقد السائق','asset','driver'),
  ('treasury_cash','نقد خزينة الإدارة','asset','system'),
  ('customer_advance','دفعات العملاء قبل التسليم','liability','customer'),
  ('merchant_sales_payable','مستحقات مبيعات التاجر','liability','merchant'),
  ('driver_earnings_payable','مستحقات أجر السائق','liability','driver'),
  ('delivery_revenue','إيراد التوصيل','income','system'),
  ('commission_revenue','إيراد عمولات المبيعات','income','system'),
  ('driver_earnings_expense','مصروف أجور السائقين','expense','system'),
  ('subscription_receivable','ذمم اشتراك التاجر','asset','merchant'),
  ('subscription_revenue','إيراد الاشتراكات','income','system'),
  ('subscription_unallocated','دفعات اشتراك غير مخصصة','liability','merchant'),
  ('authorized_suspense_asset','تعليق أصل لاستثناء معتمد','asset','system'),
  ('authorized_suspense_liability','تعليق التزام لاستثناء معتمد','liability','system');

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  definition_code text not null references public.financial_account_definitions(code) on delete restrict,
  merchant_id uuid references public.merchants(id) on delete restrict,
  owner_user_id uuid references public.profiles(id) on delete restrict,
  currency public.currency_code not null default 'SYP' check (currency = 'SYP'),
  created_at timestamptz not null default clock_timestamp(),
  check (num_nonnulls(merchant_id, owner_user_id) <= 1)
);
create unique index financial_accounts_system_once on public.financial_accounts(definition_code)
  where merchant_id is null and owner_user_id is null;
create unique index financial_accounts_merchant_once on public.financial_accounts(definition_code, merchant_id)
  where merchant_id is not null;
create unique index financial_accounts_user_once on public.financial_accounts(definition_code, owner_user_id)
  where owner_user_id is not null;

create function finance_private.validate_account_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare required_owner text; actual_role public.account_role;
begin
  select owner_kind into strict required_owner from public.financial_account_definitions where code = new.definition_code;
  if required_owner = 'system' then
    if new.merchant_id is not null or new.owner_user_id is not null then raise exception 'system account cannot have a party'; end if;
  elsif required_owner = 'merchant' then
    if new.merchant_id is null or new.owner_user_id is not null then raise exception 'merchant account requires merchant'; end if;
    if not exists(select 1 from public.merchants m join public.profiles p on p.id = m.owner_user_id
      where m.id = new.merchant_id and p.role = 'merchant') then raise exception 'merchant owner role mismatch'; end if;
  else
    select role into actual_role from public.profiles where id = new.owner_user_id;
    if new.merchant_id is not null or actual_role is distinct from required_owner::public.account_role then
      raise exception 'account owner role mismatch';
    end if;
  end if;
  return new;
end;
$$;
create trigger financial_account_validate before insert on public.financial_accounts
for each row execute function finance_private.validate_account_owner();
create trigger financial_account_immutable before update or delete on public.financial_accounts
for each row execute function finance_private.reject_mutation();
create trigger financial_account_definition_immutable before update or delete on public.financial_account_definitions
for each row execute function finance_private.reject_mutation();

-- Exact, unscaled numeric is intentional: numeric(20,0) would round fractions
-- before a CHECK could reject them. Monetary checks enforce the 20-digit range.
create table public.financial_operations (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_role public.account_role not null,
  operation_type text not null check (char_length(operation_type) between 1 and 100),
  attempt_key uuid not null,
  canonical_input jsonb not null check (jsonb_typeof(canonical_input) = 'object'),
  result jsonb,
  state text not null default 'pending' check (state in ('pending','completed','rejected')),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  unique (actor_id, attempt_key),
  check ((state = 'pending' and result is null and completed_at is null)
    or (state in ('completed','rejected') and result is not null and completed_at is not null))
);

create table public.financial_events (
  id uuid primary key default gen_random_uuid(),
  source_reference_id uuid not null references public.financial_document_references(id) on delete restrict,
  event_type text not null check (char_length(event_type) between 1 and 100),
  operation_id uuid not null references public.financial_operations(id) on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  unique (source_reference_id, event_type)
);
create index financial_events_operation_idx on public.financial_events(operation_id);
create trigger financial_event_immutable before update or delete on public.financial_events
for each row execute function finance_private.reject_mutation();

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.financial_events(id) on delete restrict,
  reference_id uuid not null unique references public.financial_document_references(id) on delete restrict,
  currency public.currency_code not null default 'SYP' check (currency = 'SYP'),
  status text not null default 'building' check (status in ('building','posted')),
  reversal_of uuid unique references public.journal_entries(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 2 and 1500),
  created_at timestamptz not null default clock_timestamp(),
  posted_at timestamptz,
  check ((status = 'posted') = (posted_at is not null))
);
alter table public.financial_document_references add constraint financial_reference_journal_fkey
foreign key (journal_entry_id) references public.journal_entries(id) on delete restrict deferrable initially deferred;

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  side text not null check (side in ('debit','credit')),
  amount numeric not null check (amount > 0 and amount < 100000000000000000000
    and amount = trunc(amount) and amount::text not in ('NaN','Infinity','-Infinity')),
  unique (journal_entry_id, line_number)
);
create index journal_lines_account_idx on public.journal_lines(account_id, journal_entry_id);

create function finance_private.guard_journal_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ref_id uuid;
begin
  if tg_op = 'DELETE' then raise exception 'journal entries cannot be deleted'; end if;
  if tg_op = 'UPDATE' then
    if old.status <> 'building' or new.status <> 'posted'
      or (to_jsonb(new) - 'status' - 'posted_at') is distinct from (to_jsonb(old) - 'status' - 'posted_at') then
      raise exception 'journal identity is immutable';
    end if;
    new.posted_at := clock_timestamp();
    return new;
  end if;
  if new.status <> 'building' or new.posted_at is not null then raise exception 'journal must be built before posting'; end if;
  insert into public.financial_document_references(kind, document_id, journal_entry_id)
  values ('TXN', new.id, new.id) returning id into ref_id;
  new.reference_id := ref_id;
  new.created_at := clock_timestamp();
  return new;
end;
$$;
create trigger journal_entry_guard before insert or update or delete on public.journal_entries
for each row execute function finance_private.guard_journal_entry();

create function finance_private.guard_journal_line()
returns trigger language plpgsql security definer set search_path = '' as $$
declare entry_status text;
begin
  if tg_op <> 'INSERT' then raise exception 'journal lines cannot be changed'; end if;
  select status into strict entry_status from public.journal_entries where id = new.journal_entry_id for update;
  if entry_status <> 'building' then raise exception 'posted journal is immutable'; end if;
  return new;
end;
$$;
create trigger journal_line_guard before insert or update or delete on public.journal_lines
for each row execute function finance_private.guard_journal_line();

create function finance_private.check_journal(target_entry uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare entry_row public.journal_entries%rowtype; debit_total numeric; credit_total numeric;
begin
  select * into strict entry_row from public.journal_entries where id = target_entry for update;
  select coalesce(sum(amount) filter (where side = 'debit'),0), coalesce(sum(amount) filter (where side = 'credit'),0)
  into debit_total, credit_total from public.journal_lines where journal_entry_id = target_entry;
  if entry_row.status <> 'posted' or debit_total <= 0 or debit_total <> credit_total then
    raise exception 'journal must be posted and balanced';
  end if;
  if entry_row.reversal_of is not null then
    if not exists(select 1 from public.journal_entries where id = entry_row.reversal_of and status = 'posted' and reversal_of is null) then
      raise exception 'reversal requires an original posted journal';
    end if;
    if exists (
      select account_id, side, sum(amount) from public.journal_lines where journal_entry_id = target_entry group by account_id, side
      except
      select account_id, case side when 'debit' then 'credit' else 'debit' end, sum(amount)
      from public.journal_lines where journal_entry_id = entry_row.reversal_of group by account_id, side
    ) or exists (
      select account_id, case side when 'debit' then 'credit' else 'debit' end, sum(amount)
      from public.journal_lines where journal_entry_id = entry_row.reversal_of group by account_id, side
      except
      select account_id, side, sum(amount) from public.journal_lines where journal_entry_id = target_entry group by account_id, side
    ) then raise exception 'reversal must exactly invert the original'; end if;
  end if;
end;
$$;

create function finance_private.enforce_journal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'journal_entries' then
    perform finance_private.check_journal(new.id);
  else
    perform finance_private.check_journal(new.journal_entry_id);
  end if;
  return null;
end;
$$;
create constraint trigger journal_entry_complete after insert or update on public.journal_entries
deferrable initially deferred for each row execute function finance_private.enforce_journal();
create constraint trigger journal_line_balanced after insert on public.journal_lines
deferrable initially deferred for each row execute function finance_private.enforce_journal();

create function finance_private.guard_operation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'operations cannot be deleted'; end if;
  if old.state <> 'pending' or new.state not in ('completed','rejected')
    or (to_jsonb(new) - 'state' - 'result' - 'completed_at') is distinct from (to_jsonb(old) - 'state' - 'result' - 'completed_at') then
    raise exception 'operation identity is immutable';
  end if;
  if exists(select 1 from public.financial_events e where e.operation_id = old.id
    and (new.state = 'rejected' or new.result @> '{"rejected":true}'::jsonb
      or not exists(select 1 from public.journal_entries j where j.event_id=e.id and j.status='posted'))) then
    raise exception 'financial event requires a posted journal and successful operation';
  end if;
  if new.state = 'completed' and new.result @> '{"rejected":true}'::jsonb then
    raise exception 'failed attempt must use rejected operation state';
  end if;
  new.completed_at := clock_timestamp();
  return new;
end;
$$;
create trigger financial_operation_guard before update or delete on public.financial_operations
for each row execute function finance_private.guard_operation();

create function finance_private.require_completed_operation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.financial_operations where id = new.id and state in ('completed','rejected')) then
    raise exception 'operation must complete in its transaction';
  end if;
  return null;
end;
$$;
create constraint trigger financial_operation_complete after insert on public.financial_operations
deferrable initially deferred for each row execute function finance_private.require_completed_operation();

create function finance_private.begin_operation(operation_name text, key_value uuid, trusted_input jsonb)
returns public.financial_operations language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); role_value public.account_role; operation_row public.financial_operations%rowtype;
begin
  perform finance_private.defer_foundation_constraints();
  select role into role_value from public.profiles where id = actor;
  if actor is null or role_value is null then raise exception 'authenticated profile required' using errcode = '42501'; end if;
  insert into public.financial_operations(actor_id, actor_role, operation_type, attempt_key, canonical_input)
  values (actor, role_value, operation_name, key_value, trusted_input)
  on conflict (actor_id, attempt_key) do nothing;
  select * into strict operation_row from public.financial_operations where actor_id = actor and attempt_key = key_value for update;
  if operation_row.operation_type is distinct from operation_name or operation_row.canonical_input is distinct from trusted_input then
    raise exception 'attempt key input mismatch';
  end if;
  return operation_row;
end;
$$;

create function finance_private.complete_operation(target_operation uuid, trusted_result jsonb, rejected_attempt boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.financial_operations set state = case when rejected_attempt then 'rejected' else 'completed' end,
    result = trusted_result, completed_at = clock_timestamp()
  where id = target_operation and actor_id = auth.uid() and state = 'pending';
  if not found then raise exception 'pending owned operation required'; end if;
end;
$$;

create function finance_private.record_financial_event(target_reference uuid, event_name text, target_operation uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare event_id uuid;
begin
  perform finance_private.defer_foundation_constraints();
  -- Lock the source first. A different attempt key cannot duplicate its event.
  perform 1 from public.financial_document_references where id = target_reference for update;
  if not found then raise exception 'registered source required'; end if;
  perform 1 from public.financial_operations
  where id = target_operation and actor_id = auth.uid() and state = 'pending' for update;
  if not found then raise exception 'pending owned operation required' using errcode = '42501'; end if;
  insert into public.financial_events(source_reference_id, event_type, operation_id)
  values (target_reference, event_name, target_operation)
  on conflict (source_reference_id, event_type) do nothing returning id into event_id;
  if event_id is null then
    select id into strict event_id from public.financial_events where source_reference_id = target_reference and event_type = event_name;
  end if;
  return event_id;
end;
$$;

create function finance_private.post_journal(target_event uuid, trusted_lines jsonb, posting_reason text, original_entry uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare entry_id uuid; existing_id uuid; line_value jsonb; line_index integer := 0; operation_actor uuid; operation_state text;
begin
  perform finance_private.defer_foundation_constraints();
  -- Event lock serializes all writers, including retries using different keys.
  select o.actor_id, o.state into strict operation_actor, operation_state from public.financial_events e
  join public.financial_operations o on o.id = e.operation_id where e.id = target_event for update of e;
  if operation_actor is distinct from auth.uid() then raise exception 'operation actor mismatch' using errcode = '42501'; end if;
  if jsonb_typeof(trusted_lines) is distinct from 'array' or jsonb_array_length(trusted_lines) < 2 then raise exception 'journal needs lines'; end if;
  select id into existing_id from public.journal_entries where event_id = target_event;
  if existing_id is not null then
    -- Callers recover the persisted result, never silently replace it.
    raise exception 'economic event already posted' using errcode = '23505';
  end if;
  if operation_state <> 'pending' then raise exception 'posting requires a pending operation'; end if;
  if original_entry is not null then perform 1 from public.journal_entries where id = original_entry for update; end if;
  insert into public.journal_entries(event_id, reason, reversal_of)
  values (target_event, posting_reason, original_entry) returning id into entry_id;
  for line_value in select value from jsonb_array_elements(trusted_lines) loop
    line_index := line_index + 1;
    insert into public.journal_lines(journal_entry_id, line_number, account_id, side, amount)
    values (entry_id, line_index, (line_value->>'account_id')::uuid, line_value->>'side', (line_value->>'amount')::numeric);
  end loop;
  update public.journal_entries set status = 'posted' where id = entry_id;
  perform finance_private.check_journal(entry_id);
  return entry_id;
end;
$$;

-- A financial event is a committed economic fact, not a failed attempt.
-- It cannot survive its transaction without its unique posted journal.
create function finance_private.require_posted_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.journal_entries j
    join public.financial_operations o on o.id = new.operation_id
    where j.event_id = new.id and j.status = 'posted' and o.state = 'completed'
      and not (o.result @> '{"rejected":true}'::jsonb)) then
    raise exception 'financial event cannot commit without its posted journal and successful result';
  end if;
  return null;
end;
$$;
create constraint trigger financial_event_complete after insert on public.financial_events
deferrable initially deferred for each row execute function finance_private.require_posted_event();

-- Dedicated RPCs can enter under SET CONSTRAINTS ALL IMMEDIATE. Only these
-- construction invariants are deferred, and callers may force them after finish.
create function finance_private.defer_foundation_constraints()
returns void language plpgsql security definer set search_path = '' as $$
begin
  set constraints public.financial_reference_journal_fkey, public.journal_entry_complete,
    public.journal_line_balanced, public.financial_operation_complete, public.financial_event_complete deferred;
end;
$$;

-- Foundation only: no call is attached to any existing order transition.
create table public.order_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete restrict,
  store_order_id uuid references public.store_orders(id) on delete restrict,
  delivery_task_id uuid references public.delivery_tasks(id) on delete restrict,
  order_sequence bigint not null check (order_sequence > 0),
  event_type text not null check (char_length(event_type) between 1 and 100),
  from_status text,
  to_status text,
  occurred_at timestamptz not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_role public.account_role not null,
  operation_source text not null check (char_length(operation_source) between 1 and 100),
  natural_key text not null check (char_length(natural_key) between 1 and 200),
  reason text,
  correction_of uuid unique references public.order_lifecycle_events(id) on delete restrict,
  unique (customer_order_id, order_sequence),
  unique (customer_order_id, natural_key),
  check (correction_of is null or (reason is not null and char_length(trim(reason)) >= 2))
);
create index lifecycle_store_time_idx on public.order_lifecycle_events(store_order_id, occurred_at);
create index lifecycle_task_time_idx on public.order_lifecycle_events(delivery_task_id, occurred_at);
create trigger lifecycle_event_immutable before update or delete on public.order_lifecycle_events
for each row execute function finance_private.reject_mutation();

create function finance_private.validate_lifecycle_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actual_role public.account_role;
begin
  perform 1 from public.customer_orders where id = new.customer_order_id for update;
  if not found then raise exception 'order missing'; end if;
  if new.store_order_id is not null and not exists(select 1 from public.store_orders where id = new.store_order_id and customer_order_id = new.customer_order_id) then
    raise exception 'store order belongs to another parent';
  end if;
  if new.delivery_task_id is not null and not exists(select 1 from public.delivery_tasks where id = new.delivery_task_id and customer_order_id = new.customer_order_id) then
    raise exception 'task belongs to another parent';
  end if;
  if new.correction_of is not null and not exists(select 1 from public.order_lifecycle_events where id = new.correction_of and customer_order_id = new.customer_order_id) then
    raise exception 'correction belongs to another parent';
  end if;
  select role into actual_role from public.profiles where id = auth.uid();
  if actual_role is null then raise exception 'authenticated profile required' using errcode = '42501'; end if;
  new.actor_id := auth.uid();
  new.actor_role := actual_role;
  new.occurred_at := clock_timestamp();
  select coalesce(max(order_sequence), 0) + 1 into new.order_sequence
  from public.order_lifecycle_events where customer_order_id = new.customer_order_id;
  return new;
end;
$$;
create trigger lifecycle_event_validate before insert on public.order_lifecycle_events
for each row execute function finance_private.validate_lifecycle_event();

create function finance_private.append_lifecycle_event(target_order uuid, target_store_order uuid,
  target_task uuid, event_name text, previous_status text, next_status text, source_name text,
  key_value text, event_reason text default null, corrected_event uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.order_lifecycle_events%rowtype; event_id uuid;
begin
  perform 1 from public.customer_orders where id = target_order for update;
  if not found then raise exception 'order missing'; end if;
  select * into existing from public.order_lifecycle_events where customer_order_id = target_order and natural_key = key_value;
  if found then
    if existing.store_order_id is distinct from target_store_order or existing.delivery_task_id is distinct from target_task
      or existing.event_type is distinct from event_name or existing.from_status is distinct from previous_status
      or existing.to_status is distinct from next_status or existing.operation_source is distinct from source_name
      or existing.reason is distinct from event_reason or existing.correction_of is distinct from corrected_event
      or existing.actor_id is distinct from auth.uid() then raise exception 'event key input mismatch'; end if;
    return existing.id;
  end if;
  insert into public.order_lifecycle_events(customer_order_id, store_order_id, delivery_task_id,
    event_type, from_status, to_status, operation_source, natural_key, reason, correction_of)
  values (target_order, target_store_order, target_task, event_name, previous_status, next_status,
    source_name, key_value, event_reason, corrected_event) returning id into event_id;
  return event_id;
end;
$$;

-- Raw records expose counterparties and request input. C2 permits admin reads
-- only; role-specific statements will be narrow projections in later phases.
do $$
declare table_name text;
begin
  foreach table_name in array array['financial_document_references','financial_account_definitions',
    'financial_accounts','financial_operations','financial_events','journal_entries','journal_lines','order_lifecycle_events'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format('create policy c2_admin_read on public.%I for select to authenticated using (public.is_admin())', table_name);
  end loop;
end;
$$;
revoke all on all functions in schema finance_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema finance_private from public, anon, authenticated, service_role;
alter default privileges in schema finance_private revoke execute on functions from public;
alter default privileges in schema finance_private revoke all on sequences from public;

-- Recovery exposes only the current actor's completed result, not canonical input.
create function public.get_c2_financial_operation(attempt_key_value uuid)
returns table(operation_id uuid, operation_type text, result jsonb, operation_state text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id = auth.uid()) then
    raise exception 'authenticated profile required' using errcode = '42501';
  end if;
  return query select o.id, o.operation_type, o.result, o.state from public.financial_operations o
  where o.actor_id = auth.uid() and o.attempt_key = attempt_key_value and o.state in ('completed','rejected');
end;
$$;
revoke all on function public.get_c2_financial_operation(uuid) from public, anon, service_role;
grant execute on function public.get_c2_financial_operation(uuid) to authenticated;

create function public.find_c2_document_reference(reference_value text)
returns table(document_kind text, document_id uuid, public_reference text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'administrator required' using errcode = '42501';
  end if;
  return query select r.kind, r.document_id, r.public_reference
  from public.financial_document_references r where r.public_reference = reference_value;
end;
$$;
revoke all on function public.find_c2_document_reference(text) from public, anon, service_role;
grant execute on function public.find_c2_document_reference(text) to authenticated;

commit;
