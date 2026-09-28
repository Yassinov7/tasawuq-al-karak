-- Switch customer authentication to confirmed email/password while keeping
-- phone numbers as optional, user-managed contact details.
alter table public.profiles
  drop constraint if exists profiles_phone_key,
  alter column phone drop not null,
  add column if not exists phone_verified_at timestamptz;

-- Preserve the verified state of existing phone-auth users from Supabase Auth.
update public.profiles as profile
set phone_verified_at = auth_user.phone_confirmed_at
from auth.users as auth_user
where auth_user.id = profile.id
  and auth_user.phone_confirmed_at is not null
  and profile.phone_verified_at is null;

-- Email signups store the entered phone in user metadata; it is contact-only
-- until a future phone verification flow is enabled.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, display_name)
  values (
    new.id,
    nullif(coalesce(new.phone, new.raw_user_meta_data ->> 'phone', ''), ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do update
    set phone = coalesce(excluded.phone, public.profiles.phone),
        display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name);

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;

  return new;
end;
$$;

-- Users may update their contact phone, but cannot mark it as verified or
-- change account status themselves.
create or replace function public.guard_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.status := old.status;
    new.phone_verified_at := old.phone_verified_at;
  end if;
  return new;
end;
$$;
