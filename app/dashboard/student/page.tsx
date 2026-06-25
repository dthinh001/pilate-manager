import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatTimeRange, nowIso } from "@/lib/time";
import { bookSlot, cancelBooking, rescheduleBooking } from "@/app/actions/student";
import type { SlotSummary } from "@/lib/types";

type AnyRow = Record<string, any>;

export default async function StudentDashboardPage() {
  const { profile, supabase } = await requireRole(["student"]);

  const [{ data: membership }, { data: slots }, { data: bookings }] = await Promise.all([
    supabase.from("student_memberships").select("*").eq("student_id", profile.id).maybeSingle(),
    supabase
      .from("slot_summaries")
      .select("*")
      .eq("status", "open")
      .gte("starts_at", nowIso())
      .order("starts_at", { ascending: true })
      .limit(80),
    supabase
      .from("bookings")
      .select("*, slot:teacher_slots!bookings_slot_id_fkey(starts_at,ends_at,status, teacher:profiles!teacher_slots_teacher_id_fkey(full_name,email))")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const availableSlots = ((slots || []) as SlotSummary[]).filter((slot) => slot.remaining_seats > 0);
  const activeBookings = (bookings || []).filter((b: AnyRow) => b.status === "booked");
  const history = bookings || [];

  return (
    <main className="container">
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Student dashboard</h1>
          <p className="muted">Book, cancel, reschedule, and review your class history.</p>
        </div>
        <Link className="btn secondary" href="/logout">Logout</Link>
      </div>

      <div className="grid three">
        <section className="card">
          <h2>Remaining sessions</h2>
          <div className="kpi">{membership?.remaining_sessions ?? 0}</div>
          <p className="muted">Total: {membership?.total_sessions ?? 0}</p>
        </section>
        <section className="card">
          <h2>Upcoming bookings</h2>
          <div className="kpi">{activeBookings.length}</div>
          <p className="muted">Classes currently booked.</p>
        </section>
        <section className="card">
          <h2>Available slots</h2>
          <div className="kpi">{availableSlots.length}</div>
          <p className="muted">Open classes with seats.</p>
        </section>
      </div>

      <section className="card">
        <h2>My upcoming classes</h2>
        {activeBookings.length === 0 ? <p className="muted">No upcoming bookings.</p> : null}
        {activeBookings.map((booking: AnyRow) => (
          <div className="slot" key={booking.id}>
            <strong>{booking.slot ? formatTimeRange(booking.slot.starts_at, booking.slot.ends_at) : "Class"}</strong>
            <p className="muted">Teacher: {booking.slot?.teacher?.full_name || booking.slot?.teacher?.email || "-"}</p>
            <div className="inline">
              <form action={cancelBooking}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <button className="btn small danger">Cancel</button>
              </form>
              <form action={rescheduleBooking} className="inline">
                <input type="hidden" name="booking_id" value={booking.id} />
                <select name="new_slot_id" required defaultValue="">
                  <option value="" disabled>Choose new slot</option>
                  {availableSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {formatTimeRange(slot.starts_at, slot.ends_at)} - {slot.teacher_name || slot.teacher_email} ({slot.remaining_seats} left)
                    </option>
                  ))}
                </select>
                <button className="btn small secondary">Reschedule</button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Book a class</h2>
        {availableSlots.length === 0 ? <p className="muted">No available slots right now.</p> : null}
        {availableSlots.map((slot) => (
          <div className="slot" key={slot.id}>
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <strong>{formatTimeRange(slot.starts_at, slot.ends_at)}</strong>
              <span className="badge green">{slot.remaining_seats} seats left</span>
            </div>
            <p className="muted">Teacher: {slot.teacher_name || slot.teacher_email || "-"} | Capacity: {slot.booked_count}/{slot.capacity}</p>
            <form action={bookSlot}>
              <input type="hidden" name="slot_id" value={slot.id} />
              <button className="btn small">Book</button>
            </form>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Class history</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Class</th><th>Teacher</th><th>Status</th><th>Booked at</th></tr></thead>
            <tbody>
              {history.map((booking: AnyRow) => (
                <tr key={booking.id}>
                  <td>{booking.slot ? formatTimeRange(booking.slot.starts_at, booking.slot.ends_at) : "-"}</td>
                  <td>{booking.slot?.teacher?.full_name || booking.slot?.teacher?.email || "-"}</td>
                  <td><span className="badge">{booking.status}</span></td>
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
