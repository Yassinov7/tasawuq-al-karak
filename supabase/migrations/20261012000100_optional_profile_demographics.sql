alter table public.profiles
  add column age_range text,
  add column gender text,
  add constraint profiles_age_range_check
    check (
      age_range is null
      or age_range in ('under_18', '18_24', '25_34', '35_44', '45_54', '55_plus')
    ),
  add constraint profiles_gender_check
    check (
      gender is null
      or gender in ('woman', 'man', 'non_binary', 'another_identity')
    );

comment on column public.profiles.age_range is
  'Optional self-reported age range for aggregate segmentation; not age verification.';
comment on column public.profiles.gender is
  'Optional self-reported gender identity; not for operational decision-making.';

grant update (age_range, gender) on public.profiles to authenticated;

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
  if selected_gender not in ('woman', 'man', 'non_binary', 'another_identity') then
    selected_gender := null;
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

do $$
declare
  profile_trigger_function oid := 'public.create_profile_for_auth_user()'::regprocedure;
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
      and (tgtype & 4) = 4
      and tgfoid <> profile_trigger_function
  ) then
    raise exception
      'auth.users already has an insert trigger; inspect the deployed profile creation trigger before applying this migration';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
      and (tgtype & 4) = 4
      and tgfoid = profile_trigger_function
  ) then
    create trigger create_profile_for_auth_user_after_insert
      after insert on auth.users
      for each row execute function public.create_profile_for_auth_user();
  end if;
end;
$$;
