import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { bookingStatusLabel, slotStatusLabel } from "@/lib/labels";
import { formatDateTime, formatTimeRange, formatWeekRange, getStudioWeekRangeIso, hasClassStarted, nowIso } from "@/lib/time";
import { cancelSlot, createSlot, markAttendance } from "@/app/actions/teacher";
import { RealtimeRefresher } from "@/components/realtime-refresher";

type AnyRow = Record<string, any>;

export default async function TeacherDashboardPage() {
  const { profile, supabase } = await requireRole(["teacher", "admin"]);
  const { startIso: weekStartIso, endIso: weekEndIso } = getStudioWeekRangeIso();

  const { data: slots } = await supabase
    .from("teacher_slots")
    .select("*, bookings(id,status, student:profiles!bookings_student_id_fkey(full_name,email,phone))")
    .eq("teacher_id", profile.id)
    .gte("starts_at", weekStartIso)
    .lt("starts_at", weekEndIso)
    .order("starts_at", { ascending: true });

  return (
    <main className="container">
      <RealtimeRefresher />
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Trang giáo viên</h1>
          <p className="muted">Tạo lịch dạy linh hoạt, xem học viên đặt lớp và điểm danh đúng giờ học.</p>
        </div>
        <Link className="btn secondary" href="/logout">Đăng xuất</Link>
      </div>

      <section className="card">
        <h2>Tạo lịch dạy</h2>
        <p className="muted">Giáo viên có thể chọn giờ linh hoạt, ví dụ 18:15 - 19:15.</p>
        <form className="form" action={createSlot}>
          <div className="form-row">
            <label>Giờ bắt đầu<input name="starts_at" type="datetime-local" required /></label>
            <label>Giờ kết thúc<input name="ends_at" type="datetime-local" required /></label>
          </div>
          <div className="form-row">
            <label>Số học viên tối đa<input name="capacity" type="number" min="1" defaultValue="5" required /></label>
            <label>Ghi chú<input name="note" placeholder="Ví dụ: lớp cơ bản, lớp thảm..." /></label>
          </div>
          <button className="btn">Tạo lịch</button>
        </form>
      </section>

      <section className="card">
        <h2>Lịch dạy tuần này</h2>
        <p className="muted">Tuần {formatWeekRange(weekStartIso, weekEndIso)}. Thời gian hiện tại: {formatDateTime(nowIso())}</p>
        {(slots || []).length === 0 ? <p className="muted">Chưa có lịch dạy trong tuần này.</p> : null}
        {(slots || []).map((slot: AnyRow) => {
          const bookings = (slot.bookings || []).filter((b: AnyRow) => b.status !== "cancelled");
          const bookedCount = bookings.length;
          const canMarkAttendance = hasClassStarted(slot.starts_at);

          return (
            <div className="slot" key={slot.id}>
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <strong>{formatTimeRange(slot.starts_at, slot.ends_at)}</strong>
                <span className={slot.status === "open" ? "badge green" : "badge red"}>{slotStatusLabel(slot.status)}</span>
              </div>
              <p className="muted">Số lượng: {bookedCount}/{slot.capacity} {slot.note ? `| ${slot.note}` : ""}</p>

              {slot.status === "open" ? (
                <form action={cancelSlot}>
                  <input type="hidden" name="slot_id" value={slot.id} />
                  <button className="btn small danger" type="submit">Hủy lớp</button>
                </form>
              ) : null}

              <div>
                <h3>Học viên đã đặt</h3>
                {bookings.length === 0 ? <p className="muted">Chưa có học viên đặt lớp này.</p> : null}
                {bookings.map((booking: AnyRow) => (
                  <div className="inline" key={booking.id} style={{ marginBottom: 8 }}>
                    <span>{booking.student?.full_name || booking.student?.email || "Học viên"}</span>
                    {booking.student?.phone ? <span className="muted">{booking.student.phone}</span> : null}
                    <span className="badge">{bookingStatusLabel(booking.status)}</span>
                    {canMarkAttendance ? (
                      <>
                        <form action={markAttendance} className="inline">
                          <input type="hidden" name="booking_id" value={booking.id} />
                          <input type="hidden" name="status" value="completed" />
                          <button className="btn small secondary">Có mặt</button>
                        </form>
                        <form action={markAttendance} className="inline">
                          <input type="hidden" name="booking_id" value={booking.id} />
                          <input type="hidden" name="status" value="absent" />
                          <button className="btn small secondary">Vắng</button>
                        </form>
                      </>
                    ) : (
                      <span className="muted">Chưa đến giờ điểm danh</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
