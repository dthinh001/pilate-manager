-- Patch v3: Vietnamese UI support, current-week booking rule, attendance safety, realtime publication.
alter table public.profiles add column if not exists phone text;

create or replace function public.is_in_current_studio_week(target_time timestamptz)
returns boolean
language sql
stable
as $$
  select date_trunc('week', target_time at time zone 'Asia/Ho_Chi_Minh')
       = date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh');
$$;

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
