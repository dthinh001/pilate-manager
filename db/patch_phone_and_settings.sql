-- Patch for older installs of this MVP.
-- Run this in Supabase SQL Editor if your current database was created before phone support.

alter table public.profiles
add column if not exists phone text;

-- Make sure profile bootstrap also stores phone from user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_role public.user_role := 'student';
begin
  if new.raw_user_meta_data ? 'role' then
    desired_role := (new.raw_user_meta_data ->> 'role')::public.user_role;
  end if;

  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    desired_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone);

  if desired_role = 'student' then
    insert into public.student_memberships (student_id, total_sessions, remaining_sessions)
    values (new.id, 0, 0)
    on conflict (student_id) do nothing;
  end if;

  return new;
end;
$$;
