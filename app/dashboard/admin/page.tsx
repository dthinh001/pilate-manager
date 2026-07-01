import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { activeLabel, bookingStatusLabel, roleLabel, slotStatusLabel } from "@/lib/labels";
import { formatDateTime, formatTimeRange, hasClassStarted, nowIso } from "@/lib/time";
import { createUserByAdmin, inviteUser, setUserActive, updateMembership, updateUserContact, updateUserRole } from "@/app/actions/admin";
import { markAttendance } from "@/app/actions/teacher";
import { RealtimeRefresher } from "@/components/realtime-refresher";

type AnyRow = Record<string, any>;

function bookingBadgeClass(status: string) {
  if (status === "completed") return "badge green";
  if (status === "absent" || status === "cancelled") return "badge red";
  return "badge";
}

function SectionSummary({ title, description }: { title: string; description: string }) {
  return (
    <summary>
      <div>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      <span className="toggle-pill" aria-hidden="true" />
    </summary>
  );
}

export default async function AdminDashboardPage(props: { searchParams?: Promise<Record<string, string>> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const { supabase } = await requireRole(["admin"]);

  const [{ data: profiles }, { data: memberships }, { data: slots }, { data: history }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("student_memberships").select("*"),
    supabase
      .from("teacher_slots")
      .select("*, teacher:profiles!teacher_slots_teacher_id_fkey(full_name,email,phone), bookings(id,status, student:profiles!bookings_student_id_fkey(full_name,email,phone))")
      .gte("starts_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("*, student:profiles!bookings_student_id_fkey(full_name,email,phone), slot:teacher_slots!bookings_slot_id_fkey(starts_at,ends_at, teacher:profiles!teacher_slots_teacher_id_fkey(full_name,email,phone))")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const allProfiles = profiles || [];
  const allSlots = slots || [];
  const allHistory = history || [];
  const students = allProfiles.filter((p: AnyRow) => p.role === "student");
  const teachers = allProfiles.filter((p: AnyRow) => p.role === "teacher");
  const openSlots = allSlots.filter((slot: AnyRow) => slot.status === "open");
  const bookedHistory = allHistory.filter((booking: AnyRow) => booking.status === "booked");

  return (
    <main className="container">
      <RealtimeRefresher />
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Trang quản trị</h1>
          <p className="muted">Quản lý tài khoản, số buổi tập, lịch lớp và lịch sử điểm danh.</p>
          {searchParams?.created === "1" ? <p className="success">Đã tạo tài khoản. Gửi email và mật khẩu ban đầu cho người dùng, sau đó nhắc họ đổi mật khẩu.</p> : null}
          {searchParams?.invited === "1" ? <p className="success">Đã gửi email mời tài khoản.</p> : null}
        </div>
        <Link className="btn secondary" href="/logout">Đăng xuất</Link>
      </div>

      <section className="card admin-toolbar">
        <div className="inline" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Tổng quan</h2>
            <p className="muted">Thời gian hiện tại: {formatDateTime(nowIso())}</p>
          </div>
        </div>
        <div className="grid three">
          <div><div className="kpi">{allProfiles.length}</div><p className="muted">Người dùng</p></div>
          <div><div className="kpi">{allSlots.length}</div><p className="muted">Lịch gần đây</p></div>
          <div><div className="kpi">{allHistory.length}</div><p className="muted">Lượt đặt gần đây</p></div>
        </div>
        <div className="quick-actions" aria-label="Các chức năng quản trị">
          <a className="quick-action" href="#create-account"><strong>Tạo tài khoản</strong><span>Thêm học viên, giáo viên hoặc admin.</span></a>
          <a className="quick-action" href="#users"><strong>Phân quyền</strong><span>{teachers.length} giáo viên · {students.length} học viên.</span></a>
          <a className="quick-action" href="#memberships"><strong>Số buổi tập</strong><span>Cập nhật gói và buổi còn lại.</span></a>
          <a className="quick-action" href="#schedule"><strong>Lịch lớp</strong><span>{openSlots.length} lịch đang mở.</span></a>
          <a className="quick-action" href="#history"><strong>Điểm danh</strong><span>{bookedHistory.length} lượt đang chờ xử lý.</span></a>
        </div>
        <p className="muted">Bấm vào từng mục bên dưới để mở hoặc thu gọn. Cách này giúp dashboard gọn hơn khi vận hành thật.</p>
      </section>

      <details className="card section-toggle" id="create-account" open={searchParams?.created === "1" || searchParams?.invited === "1"}>
        <SectionSummary title="Tạo tài khoản" description="Tạo tài khoản trực tiếp để tránh giới hạn gửi email của Supabase khi test." />
        <div className="section-body">
          <form className="form" action={createUserByAdmin}>
            <label>Họ tên<input name="full_name" required /></label>
            <label>Email<input name="email" type="email" required /></label>
            <label>Số điện thoại<input name="phone" type="tel" required placeholder="0901234567" /></label>
            <label>Mật khẩu ban đầu<input name="password" type="text" required minLength={8} placeholder="Ít nhất 8 ký tự" /></label>
            <label>
              Quyền
              <select name="role" defaultValue="student">
                <option value="student">Học viên</option>
                <option value="teacher">Giáo viên</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </label>
            <button className="btn" type="submit">Tạo tài khoản</button>
          </form>

          <details style={{ marginTop: 16 }}>
            <summary className="muted">Tùy chọn: gửi email mời qua Supabase</summary>
            <form className="form" action={inviteUser} style={{ marginTop: 12 }}>
              <label>Họ tên<input name="full_name" required /></label>
              <label>Email<input name="email" type="email" required /></label>
              <label>Số điện thoại<input name="phone" type="tel" required placeholder="0901234567" /></label>
              <label>
                Quyền
                <select name="role" defaultValue="student">
                  <option value="student">Học viên</option>
                  <option value="teacher">Giáo viên</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </label>
              <button className="btn secondary" type="submit">Gửi email mời</button>
            </form>
          </details>
        </div>
      </details>

      <details className="card section-toggle" id="users">
        <SectionSummary title="Người dùng và phân quyền" description="Sửa thông tin liên hệ, đổi quyền hoặc khóa tài khoản." />
        <div className="section-body">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Thông tin</th><th>Email</th><th>SĐT</th><th>Quyền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {allProfiles.map((p: AnyRow) => (
                  <tr key={p.id}>
                    <td>
                      <form className="form" action={updateUserContact}>
                        <input type="hidden" name="id" value={p.id} />
                        <input name="full_name" defaultValue={p.full_name || ""} required />
                        <input name="phone" type="tel" defaultValue={p.phone || ""} required placeholder="Số điện thoại" />
                        <button className="btn small secondary">Lưu thông tin</button>
                      </form>
                    </td>
                    <td>{p.email}</td>
                    <td>{p.phone || "-"}</td>
                    <td><span className="badge">{roleLabel(p.role)}</span></td>
                    <td>{p.active ? <span className="badge green">{activeLabel(p.active)}</span> : <span className="badge red">{activeLabel(p.active)}</span>}</td>
                    <td className="inline">
                      <form className="inline" action={updateUserRole}>
                        <input type="hidden" name="id" value={p.id} />
                        <select name="role" defaultValue={p.role}>
                          <option value="student">Học viên</option>
                          <option value="teacher">Giáo viên</option>
                          <option value="admin">Quản trị viên</option>
                        </select>
                        <button className="btn small secondary">Lưu quyền</button>
                      </form>
                      <form action={setUserActive}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                        <button className="btn small secondary">{p.active ? "Khóa" : "Mở khóa"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <details className="card section-toggle" id="memberships">
        <SectionSummary title="Số buổi tập của học viên" description="Cập nhật tổng buổi, buổi còn lại, hạn gói và ghi chú." />
        <div className="section-body">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Học viên</th><th>Tổng / Còn lại / Hạn gói / Ghi chú</th></tr></thead>
              <tbody>
                {students.map((student: AnyRow) => {
                  const member = (memberships || []).find((m: AnyRow) => m.student_id === student.id) || {};
                  return (
                    <tr key={student.id}>
                      <td>{student.full_name}<br /><span className="muted">{student.email}</span><br /><span className="muted">{student.phone || "Chưa có SĐT"}</span></td>
                      <td>
                        <form className="form" action={updateMembership}>
                          <input type="hidden" name="student_id" value={student.id} />
                          <div className="form-row">
                            <label>Tổng buổi<input name="total_sessions" type="number" min="0" defaultValue={member.total_sessions || 0} /></label>
                            <label>Còn lại<input name="remaining_sessions" type="number" min="0" defaultValue={member.remaining_sessions || 0} /></label>
                          </div>
                          <div className="form-row">
                            <label>Hạn gói<input name="expires_on" type="date" defaultValue={member.expires_on || ""} /></label>
                            <label>Ghi chú<input name="notes" defaultValue={member.notes || ""} /></label>
                          </div>
                          <button className="btn small">Lưu số buổi</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <details className="card section-toggle" id="schedule">
        <SectionSummary title="Tổng quan lịch lớp" description="Xem các lịch gần đây, số lượng giữ chỗ và danh sách học viên." />
        <div className="section-body">
          {allSlots.length === 0 ? <p className="muted">Chưa có lịch lớp gần đây.</p> : null}
          {allSlots.map((slot: AnyRow) => {
            const relevantBookings = (slot.bookings || []).filter((b: AnyRow) => b.status !== "cancelled");
            const holdingSeats = relevantBookings.length;
            return (
              <div className="slot" key={slot.id}>
                <div className="inline" style={{ justifyContent: "space-between" }}>
                  <strong>{formatTimeRange(slot.starts_at, slot.ends_at)}</strong>
                  <span className={slot.status === "open" ? "badge green" : "badge red"}>{slotStatusLabel(slot.status)}</span>
                </div>
                <p className="muted">Giáo viên: {slot.teacher?.full_name || slot.teacher?.email || "-"} | Số lượng đang giữ chỗ: {holdingSeats}/{slot.capacity}</p>
                <p>{relevantBookings.length ? relevantBookings.map((b: AnyRow) => `${b.student?.full_name || b.student?.email} (${bookingStatusLabel(b.status)})`).join(", ") : "Chưa có học viên"}</p>
              </div>
            );
          })}
        </div>
      </details>

      <details className="card section-toggle" id="history">
        <SectionSummary title="Lịch sử đặt lịch và điểm danh" description="Theo dõi học viên có mặt, vắng, đã hủy và sửa điểm danh sau giờ học." />
        <div className="section-body">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Buổi tập</th><th>Giáo viên</th><th>Học viên</th><th>Trạng thái</th><th>Đặt lúc</th><th>Sửa điểm danh</th></tr></thead>
              <tbody>
                {allHistory.map((booking: AnyRow) => {
                  const canEditAttendance = booking.status !== "cancelled" && booking.slot?.starts_at && hasClassStarted(booking.slot.starts_at);
                  return (
                    <tr key={booking.id}>
                      <td>{booking.slot ? formatTimeRange(booking.slot.starts_at, booking.slot.ends_at) : "-"}</td>
                      <td>{booking.slot?.teacher?.full_name || booking.slot?.teacher?.email || "-"}</td>
                      <td>{booking.student?.full_name || booking.student?.email || "-"}<br /><span className="muted">{booking.student?.phone || ""}</span></td>
                      <td><span className={bookingBadgeClass(booking.status)}>{bookingStatusLabel(booking.status)}</span></td>
                      <td>{formatDateTime(booking.booked_at || booking.created_at)}</td>
                      <td>
                        {canEditAttendance ? (
                          <div className="inline">
                            <form action={markAttendance}>
                              <input type="hidden" name="booking_id" value={booking.id} />
                              <input type="hidden" name="status" value="completed" />
                              <button className="btn small secondary">Có mặt</button>
                            </form>
                            <form action={markAttendance}>
                              <input type="hidden" name="booking_id" value={booking.id} />
                              <input type="hidden" name="status" value="absent" />
                              <button className="btn small secondary">Vắng</button>
                            </form>
                          </div>
                        ) : (
                          <span className="muted">Chưa đến giờ / đã hủy</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </main>
  );
}
