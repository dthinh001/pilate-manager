import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { bookingStatusLabel } from "@/lib/labels";
import { formatDateTime, formatTimeRange, formatWeekRange, getStudioWeekRangeIso, nowIso } from "@/lib/time";
import { bookSlot, cancelBooking } from "@/app/actions/student";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import type { SlotSummary } from "@/lib/types";

type AnyRow = Record<string, any>;

export default async function StudentDashboardPage() {
  const { profile, supabase } = await requireRole(["student"]);
  const currentNowIso = nowIso();
  const { startIso: weekStartIso, endIso: weekEndIso } = getStudioWeekRangeIso();

  const [{ data: membership }, { data: slots }, { data: bookings }] = await Promise.all([
    supabase.from("student_memberships").select("*").eq("student_id", profile.id).maybeSingle(),
    supabase
      .from("slot_summaries")
      .select("*")
      .eq("status", "open")
      .gte("starts_at", currentNowIso)
      .gte("starts_at", weekStartIso)
      .lt("starts_at", weekEndIso)
      .order("starts_at", { ascending: true })
      .limit(80),
    supabase
      .from("bookings")
      .select("*, slot:teacher_slots!bookings_slot_id_fkey(starts_at,ends_at,status, teacher:profiles!teacher_slots_teacher_id_fkey(full_name,email))")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const activeBookings = (bookings || [])
    .filter((b: AnyRow) => b.status === "booked")
    .sort((a: AnyRow, b: AnyRow) => new Date(a.slot?.starts_at || a.created_at).getTime() - new Date(b.slot?.starts_at || b.created_at).getTime());

  const bookedSlotIds = new Set(activeBookings.map((booking: AnyRow) => booking.slot_id));
  const availableSlots = ((slots || []) as SlotSummary[])
    .filter((slot) => slot.remaining_seats > 0 && !bookedSlotIds.has(slot.id));
  const history = bookings || [];

  return (
    <main className="container">
      <RealtimeRefresher />
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Trang học viên</h1>
          <p className="muted">Xem lịch đã đặt, đặt lịch trong tuần hiện tại và theo dõi lịch sử tập.</p>
        </div>
        <Link className="btn secondary" href="/logout">Đăng xuất</Link>
      </div>

      <div className="grid three">
        <section className="card">
          <h2>Số buổi còn lại</h2>
          <div className="kpi">{membership?.remaining_sessions ?? 0}</div>
          <p className="muted">Tổng số buổi: {membership?.total_sessions ?? 0}</p>
        </section>
        <section className="card">
          <h2>Lịch đã đặt</h2>
          <div className="kpi">{activeBookings.length}</div>
          <p className="muted">Các buổi đang giữ chỗ.</p>
        </section>
        <section className="card">
          <h2>Lớp còn chỗ</h2>
          <div className="kpi">{availableSlots.length}</div>
          <p className="muted">Chỉ hiển thị tuần {formatWeekRange(weekStartIso, weekEndIso)}.</p>
        </section>
      </div>

      <section className="card">
        <h2>Lịch đã đặt của tôi</h2>
        <p className="muted">Nếu cần đổi lịch, hãy hủy buổi cũ rồi đặt lại buổi mới còn chỗ.</p>
        {activeBookings.length === 0 ? <p className="muted">Bạn chưa có lịch đặt nào.</p> : null}
        {activeBookings.map((booking: AnyRow) => (
          <div className="slot" key={booking.id}>
            <strong>{booking.slot ? formatTimeRange(booking.slot.starts_at, booking.slot.ends_at) : "Buổi tập"}</strong>
            <p className="muted">Giáo viên: {booking.slot?.teacher?.full_name || booking.slot?.teacher?.email || "-"}</p>
            <p><span className="badge green">Đã đặt</span></p>
            <form action={cancelBooking}>
              <input type="hidden" name="booking_id" value={booking.id} />
              <button className="btn small danger">Hủy lịch</button>
            </form>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Đặt lớp trong tuần này</h2>
        <p className="muted">Học viên chỉ đặt được các lớp còn chỗ trong tuần hiện tại, tính từ thứ 2 đến chủ nhật.</p>
        {availableSlots.length === 0 ? <p className="muted">Hiện chưa có lớp còn chỗ trong tuần này.</p> : null}
        {availableSlots.map((slot) => (
          <div className="slot" key={slot.id}>
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <strong>{formatTimeRange(slot.starts_at, slot.ends_at)}</strong>
              <span className="badge green">Còn {slot.remaining_seats} chỗ</span>
            </div>
            <p className="muted">Giáo viên: {slot.teacher_name || slot.teacher_email || "-"} | Số lượng: {slot.booked_count}/{slot.capacity}</p>
            <form action={bookSlot}>
              <input type="hidden" name="slot_id" value={slot.id} />
              <button className="btn small">Đặt lịch</button>
            </form>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Lịch sử tập</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Buổi tập</th><th>Giáo viên</th><th>Trạng thái</th><th>Thời điểm đặt</th></tr></thead>
            <tbody>
              {history.map((booking: AnyRow) => (
                <tr key={booking.id}>
                  <td>{booking.slot ? formatTimeRange(booking.slot.starts_at, booking.slot.ends_at) : "-"}</td>
                  <td>{booking.slot?.teacher?.full_name || booking.slot?.teacher?.email || "-"}</td>
                  <td><span className="badge">{bookingStatusLabel(booking.status)}</span></td>
                  <td>{formatDateTime(booking.booked_at || booking.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
