do $$
begin
  if exists (
    select 1
    from public.profiles
    where gender is not null
      and gender not in ('male', 'female', 'prefer_not_to_say')
  ) then
    raise exception
      'profiles contain legacy gender values; review affected accounts and approve an explicit conversion before applying this migration';
  end if;
end;
$$;

alter table public.profiles
  drop constraint profiles_gender_check,
  add constraint profiles_gender_check
    check (gender is null or gender in ('male', 'female', 'prefer_not_to_say'));

comment on column public.profiles.gender is
  'Optional self-reported gender: male, female, or prefer_not_to_say. NULL means unanswered.';

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  selected_role public.account_role := 'customer';
  selected_name text;
  selected_age_range text;
  selected_gender text;
begin
  if new.raw_user_meta_data ->> 'signup_role' in ('customer', 'merchant', 'driver') then
    selected_role := (new.raw_user_meta_data ->> 'signup_role')::public.account_role;
  end if;

  selected_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  selected_age_range := new.raw_user_meta_data ->> 'signup_age_range';
  selected_gender := new.raw_user_meta_data ->> 'signup_gender';

  if selected_age_range not in ('under_18', '18_24', '25_34', '35_44', '45_54', '55_plus') then
    selected_age_range := null;
  end if;
  if selected_gender = 'woman' then
    selected_gender := 'female';
  elsif selected_gender = 'man' then
    selected_gender := 'male';
  elsif selected_gender is not null
    and selected_gender not in ('male', 'female', 'prefer_not_to_say') then
    raise exception
      'unsupported legacy gender choice; update the application before creating this profile';
  end if;

  insert into public.profiles(id, email, full_name, role, age_range, gender)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(selected_name, 'مستخدم'),
    selected_role,
    selected_age_range,
    selected_gender
  );

  update auth.users
  set raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb) - 'signup_age_range' - 'signup_gender'
  where id = new.id;

  return new;
end;
$$;
