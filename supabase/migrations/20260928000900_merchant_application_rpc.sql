-- A single merchant profile owns multiple branches; create the profile and
-- first branch atomically so a failed store request cannot leave a half setup.
create unique index if not exists merchants_one_profile_per_owner_idx
  on public.merchants(owner_user_id);

create or replace function public.apply_merchant_with_initial_store(
  input_legal_name text,
  input_contact_phone text,
  input_store_name text,
  input_store_description text,
  input_store_address text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_merchant_id uuid;
  new_store_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if nullif(trim(input_legal_name), '') is null
     or nullif(trim(input_contact_phone), '') is null
     or nullif(trim(input_store_name), '') is null
     or nullif(trim(input_store_address), '') is null then
    raise exception 'required application fields are missing';
  end if;
  if exists (select 1 from public.merchants where owner_user_id = current_user_id) then
    raise exception 'merchant application already exists';
  end if;

  insert into public.merchants(owner_user_id, legal_name, contact_phone)
  values (current_user_id, trim(input_legal_name), trim(input_contact_phone))
  returning id into new_merchant_id;

  insert into public.stores(merchant_id, name, description, phone, address)
  values (
    new_merchant_id,
    trim(input_store_name),
    coalesce(trim(input_store_description), ''),
    trim(input_contact_phone),
    trim(input_store_address)
  )
  returning id into new_store_id;

  return new_store_id;
end;
$$;

revoke all on function public.apply_merchant_with_initial_store(text,text,text,text,text) from public, anon;
grant execute on function public.apply_merchant_with_initial_store(text,text,text,text,text) to authenticated;
