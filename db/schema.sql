-- Pilates Booking MVP schema for Supabase
-- Run this whole file in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Types
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'teacher', 'student');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.slot_status AS ENUM ('open', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('booked', 'cancelled', 'completed', 'absent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  phone text,
  role public.user_role not null default 'student',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.profiles(id) on delete cascade,
  total_sessions integer not null default 0 check (total_sessions >= 0),
  remaining_sessions integer not null default 0 check (remaining_sessions >= 0),
  expires_on date,
  notes text,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_slots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 5 check (capacity > 0),
  status public.slot_status not null default 'open',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_slots_time_check check (ends_at > starts_at)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.teacher_slots(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.booking_status not null default 'booked',
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  attendance_marked_by uuid references public.profiles(id),
  attendance_marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bookings_unique_active_student_slot
on public.bookings(slot_id, student_id)
where status = 'booked';

create index if not exists teacher_slots_starts_at_idx on public.teacher_slots(starts_at);
create index if not exists teacher_slots_teacher_id_idx on public.teacher_slots(teacher_id);
create index if not exists bookings_student_id_idx on public.bookings(student_id);
create index if not exists bookings_slot_id_idx on public.bookings(slot_id);

create table if not exists public.studio_settings (
  id boolean primary key default true,
  studio_name text not null default 'Pilates Studio',
  cancellation_limit_hours integer not null default 6 check (cancellation_limit_hours >= 0),
  updated_at timestamptz not null default now(),
  constraint studio_settings_singleton check (id = true)
);

insert into public.studio_settings(id, studio_name, cancellation_limit_hours)
values (true, 'Pilates Studio', 6)
on conflict (id) do nothing;

-- Updated timestamp trigger
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists student_memberships_touch_updated_at on public.student_memberships;
create trigger student_memberships_touch_updated_at
before update on public.student_memberships
for each row execute function public.touch_updated_at();

drop trigger if exists teacher_slots_touch_updated_at on public.teacher_slots;
create trigger teacher_slots_touch_updated_at
before update on public.teacher_slots
for each row execute function public.touch_updated_at();

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
before update on public.bookings
for each row execute function public.touch_updated_at();

-- Auth profile bootstrap
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Role helper functions
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_role() = 'admin', false);
$$;

create or replace function public.get_cancellation_limit_hours()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select cancellation_limit_hours from public.studio_settings where id = true), 6);
$$;


create or replace function public.is_in_current_studio_week(target_time timestamptz)
returns boolean
language sql
stable
as $$
  select date_trunc('week', target_time at time zone 'Asia/Ho_Chi_Minh')
       = date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh');
$$;


-- Aggregated slot view for students. It exposes counts, not student identities.
drop view if exists public.slot_summaries;
create view public.slot_summaries as
select
  ts.id,
  ts.teacher_id,
  p.full_name as teacher_name,
  p.email as teacher_email,
  ts.starts_at,
  ts.ends_at,
  ts.capacity,
  ts.status,
  ts.note,
  count(b.id) filter (where b.status = 'booked')::integer as booked_count,
  greatest(ts.capacity - count(b.id) filter (where b.status = 'booked'), 0)::integer as remaining_seats
from public.teacher_slots ts
join public.profiles p on p.id = ts.teacher_id
left join public.bookings b on b.slot_id = ts.id
group by ts.id, p.full_name, p.email;

grant select on public.slot_summaries to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.student_memberships enable row level security;
alter table public.teacher_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.studio_settings enable row level security;

-- Profiles policies
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or role = 'teacher'
  or exists (
    select 1
    from public.bookings b
    join public.teacher_slots s on s.id = b.slot_id
    where b.student_id = public.profiles.id
      and (b.student_id = auth.uid() or s.teacher_id = auth.uid())
  )
);

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
for insert to authenticated
with check (public.is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Membership policies
drop policy if exists memberships_select on public.student_memberships;
create policy memberships_select on public.student_memberships
for select to authenticated
using (student_id = auth.uid() or public.is_admin());

drop policy if exists memberships_admin_insert on public.student_memberships;
create policy memberships_admin_insert on public.student_memberships
for insert to authenticated
with check (public.is_admin());

drop policy if exists memberships_admin_update on public.student_memberships;
create policy memberships_admin_update on public.student_memberships
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Teacher slot policies
drop policy if exists teacher_slots_select on public.teacher_slots;
create policy teacher_slots_select on public.teacher_slots
for select to authenticated
using (true);

drop policy if exists teacher_slots_insert on public.teacher_slots;
create policy teacher_slots_insert on public.teacher_slots
for insert to authenticated
with check (
  public.is_admin()
  or (teacher_id = auth.uid() and public.get_my_role() = 'teacher')
);

drop policy if exists teacher_slots_update on public.teacher_slots;
create policy teacher_slots_update on public.teacher_slots
for update to authenticated
using (
  public.is_admin()
  or (teacher_id = auth.uid() and public.get_my_role() = 'teacher')
)
with check (
  public.is_admin()
  or (teacher_id = auth.uid() and public.get_my_role() = 'teacher')
);

-- Booking policies. Insert/update are mostly handled via security definer RPC functions.
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
for select to authenticated
using (
  public.is_admin()
  or student_id = auth.uid()
  or exists (
    select 1 from public.teacher_slots s
    where s.id = public.bookings.slot_id and s.teacher_id = auth.uid()
  )
);

drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Studio settings policies
drop policy if exists studio_settings_select on public.studio_settings;
create policy studio_settings_select on public.studio_settings
for select to authenticated
using (true);

drop policy if exists studio_settings_admin_update on public.studio_settings;
create policy studio_settings_admin_update on public.studio_settings
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- RPC: book a class
create or replace function public.book_slot(target_slot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot public.teacher_slots%rowtype;
  v_booked integer;
  v_remaining integer;
  v_booking_id uuid;
begin
  if v_user is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  if public.get_my_role() <> 'student' then
    raise exception 'Chỉ học viên mới được đặt lịch';
  end if;

  select * into v_slot
  from public.teacher_slots
  where id = target_slot_id
  for update;

  if not found then
    raise exception 'Không tìm thấy lớp học';
  end if;

  if v_slot.status <> 'open' then
    raise exception 'Lớp này không còn mở đặt lịch';
  end if;

  if v_slot.starts_at <= now() then
    raise exception 'Không thể đặt lớp đã qua giờ học';
  end if;

  if not public.is_in_current_studio_week(v_slot.starts_at) then
    raise exception 'Chỉ có thể đặt lịch trong tuần hiện tại, từ thứ 2 đến chủ nhật';
  end if;

  select count(*) into v_booked
  from public.bookings
  where slot_id = target_slot_id and status = 'booked';

  if v_booked >= v_slot.capacity then
    raise exception 'Lớp đã đủ chỗ';
  end if;

  if exists (
    select 1
    from public.bookings b
    join public.teacher_slots s on s.id = b.slot_id
    where b.student_id = v_user
      and b.status = 'booked'
      and s.starts_at < v_slot.ends_at
      and s.ends_at > v_slot.starts_at
  ) then
    raise exception 'Bạn đã có lớp khác trùng giờ';
  end if;

  select remaining_sessions into v_remaining
  from public.student_memberships
  where student_id = v_user
  for update;

  if coalesce(v_remaining, 0) <= 0 then
    raise exception 'Bạn đã hết số buổi tập';
  end if;

  insert into public.bookings(slot_id, student_id, status)
  values (target_slot_id, v_user, 'booked')
  returning id into v_booking_id;

  update public.student_memberships
  set remaining_sessions = remaining_sessions - 1
  where student_id = v_user;

  return v_booking_id;
end;
$$;

-- RPC: cancel a booking. Late cancel does not refund.
create or replace function public.cancel_booking(target_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_slot public.teacher_slots%rowtype;
  v_cutoff integer := public.get_cancellation_limit_hours();
  v_refund boolean := false;
begin
  if v_user is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  select * into v_booking
  from public.bookings
  where id = target_booking_id
  for update;

  if not found then
    raise exception 'Không tìm thấy lịch đặt';
  end if;

  select * into v_slot from public.teacher_slots where id = v_booking.slot_id;

  if v_booking.student_id <> v_user and v_slot.teacher_id <> v_user and not public.is_admin() then
    raise exception 'Bạn không có quyền hủy lịch này';
  end if;

  if v_booking.status <> 'booked' then
    raise exception 'Lịch đặt này không còn hoạt động';
  end if;

  if public.is_admin() or v_slot.teacher_id = v_user or (v_slot.starts_at - now()) >= make_interval(hours => v_cutoff) then
    v_refund := true;
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = case when v_refund then 'cancelled_with_refund' else 'late_cancel_no_refund' end
  where id = target_booking_id;

  if v_refund then
    update public.student_memberships
    set remaining_sessions = remaining_sessions + 1
    where student_id = v_booking.student_id;
  end if;
end;
$$;

-- RPC: reschedule. Allowed only before cancellation window. Does not consume extra session.
create or replace function public.reschedule_booking(target_booking_id uuid, new_slot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_old_booking public.bookings%rowtype;
  v_old_slot public.teacher_slots%rowtype;
  v_new_slot public.teacher_slots%rowtype;
  v_cutoff integer := public.get_cancellation_limit_hours();
  v_booked integer;
  v_new_booking_id uuid;
begin
  if v_user is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  if public.get_my_role() <> 'student' then
    raise exception 'Chỉ học viên mới được đổi lịch';
  end if;

  select * into v_old_booking
  from public.bookings
  where id = target_booking_id
  for update;

  if not found then
    raise exception 'Không tìm thấy lịch đặt';
  end if;

  if v_old_booking.student_id <> v_user then
    raise exception 'Đây không phải lịch đặt của bạn';
  end if;

  if v_old_booking.status <> 'booked' then
    raise exception 'Chỉ có thể đổi lịch đang hoạt động';
  end if;

  select * into v_old_slot from public.teacher_slots where id = v_old_booking.slot_id;

  if (v_old_slot.starts_at - now()) < make_interval(hours => v_cutoff) then
    raise exception 'Đã quá hạn đổi lịch';
  end if;

  select * into v_new_slot
  from public.teacher_slots
  where id = new_slot_id
  for update;

  if not found then
    raise exception 'Không tìm thấy lớp mới';
  end if;

  if v_new_slot.status <> 'open' or v_new_slot.starts_at <= now() then
    raise exception 'Lớp mới không còn khả dụng';
  end if;

  if not public.is_in_current_studio_week(v_new_slot.starts_at) then
    raise exception 'Chỉ có thể đổi sang lớp trong tuần hiện tại, từ thứ 2 đến chủ nhật';
  end if;

  select count(*) into v_booked
  from public.bookings
  where slot_id = new_slot_id and status = 'booked';

  if v_booked >= v_new_slot.capacity then
    raise exception 'Lớp mới đã đủ chỗ';
  end if;

  if exists (
    select 1
    from public.bookings b
    join public.teacher_slots s on s.id = b.slot_id
    where b.student_id = v_user
      and b.status = 'booked'
      and b.id <> target_booking_id
      and s.starts_at < v_new_slot.ends_at
      and s.ends_at > v_new_slot.starts_at
  ) then
    raise exception 'Bạn đã có lớp khác trùng giờ';
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = 'rescheduled'
  where id = target_booking_id;

  insert into public.bookings(slot_id, student_id, status)
  values (new_slot_id, v_user, 'booked')
  returning id into v_new_booking_id;

  return v_new_booking_id;
end;
$$;

-- RPC: teacher/admin cancels a whole class and refunds booked students.
create or replace function public.cancel_slot(target_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot public.teacher_slots%rowtype;
begin
  if v_user is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  select * into v_slot
  from public.teacher_slots
  where id = target_slot_id
  for update;

  if not found then
    raise exception 'Không tìm thấy lớp học';
  end if;

  if v_slot.teacher_id <> v_user and not public.is_admin() then
    raise exception 'Bạn không có quyền hủy lớp này';
  end if;

  update public.teacher_slots
  set status = 'cancelled'
  where id = target_slot_id;

  with affected as (
    update public.bookings
    set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'class_cancelled_by_studio'
    where slot_id = target_slot_id and status = 'booked'
    returning student_id
  ), counts as (
    select student_id, count(*)::integer as refund_count
    from affected
    group by student_id
  )
  update public.student_memberships sm
  set remaining_sessions = sm.remaining_sessions + counts.refund_count
  from counts
  where sm.student_id = counts.student_id;
end;
$$;

-- RPC: teacher/admin attendance marking.
create or replace function public.mark_attendance(target_booking_id uuid, new_status public.booking_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_slot public.teacher_slots%rowtype;
begin
  if v_user is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  if new_status not in ('completed', 'absent') then
    raise exception 'Trạng thái điểm danh phải là có mặt hoặc vắng';
  end if;

  select * into v_booking
  from public.bookings
  where id = target_booking_id
  for update;

  if not found then
    raise exception 'Không tìm thấy booking';
  end if;

  select * into v_slot from public.teacher_slots where id = v_booking.slot_id;

  if v_slot.teacher_id <> v_user and not public.is_admin() then
    raise exception 'Bạn không có quyền điểm danh booking này';
  end if;

  if v_booking.status = 'cancelled' then
    raise exception 'Không thể điểm danh booking đã hủy';
  end if;

  if v_slot.starts_at > now() then
    raise exception 'Chỉ được điểm danh sau khi đến giờ học';
  end if;

  update public.bookings
  set status = new_status,
      attendance_marked_by = v_user,
      attendance_marked_at = now()
  where id = target_booking_id;
end;
$$;

grant execute on function public.book_slot(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.reschedule_booking(uuid, uuid) to authenticated;
grant execute on function public.cancel_slot(uuid) to authenticated;
grant execute on function public.mark_attendance(uuid, public.booking_status) to authenticated;


-- Enable Supabase Realtime for schedule and booking changes.
do $$
begin
  alter publication supabase_realtime add table public.teacher_slots;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bookings;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
