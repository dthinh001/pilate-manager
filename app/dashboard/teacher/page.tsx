import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatTimeRange, nowIso } from "@/lib/time";
import { cancelSlot, createSlot, markAttendance } from "@/app/actions/teacher";

type AnyRow = Record<string, any>;

export default async function TeacherDashboardPage() {
  const { profile, supabase } = await requireRole(["teacher", "admin"]);

  const { data: slots } = await supabase
    .from("teacher_slots")
    .select("*, bookings(id,status, student:profiles!bookings_student_id_fkey(full_name,email))")
    .eq("teacher_id", profile.id)
    .gte("starts_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true });

  return (
    <main className="container">
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Teacher dashboard</h1>
          <p className="muted">Create flexible class slots and mark attendance.</p>
        </div>
        <Link className="btn secondary" href="/logout">Logout</Link>
      </div>

      <section className="card">
        <h2>Create class slot</h2>
        <form className="form" action={createSlot}>
          <div className="form-row">
            <label>Start time<input name="starts_at" type="datetime-local" required /></label>
            <label>End time<input name="ends_at" type="datetime-local" required /></label>
          </div>
          <div className="form-row">
            <label>Capacity<input name="capacity" type="number" min="1" defaultValue="5" required /></label>
            <label>Note<input name="note" placeholder="Optional note" /></label>
          </div>
          <button className="btn">Create slot</button>
        </form>
      </section>

      <section className="card">
        <h2>My schedule</h2>
        <p className="muted">Now: {nowIso()}</p>
        {(slots || []).map((slot: AnyRow) => {
          const booked = (slot.bookings || []).filter((b: AnyRow) => b.status === "booked");
          return (
            <div className="slot" key={slot.id}>
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <strong>{formatTimeRange(slot.starts_at, slot.ends_at)}</strong>
                <span className={slot.status === "open" ? "badge green" : "badge red"}>{slot.status}</span>
              </div>
              <p className="muted">Capacity: {booked.length}/{slot.capacity} {slot.note ? `| ${slot.note}` : ""}</p>

              {slot.status === "open" ? (
                <form action={cancelSlot}>
                  <input type="hidden" name="slot_id" value={slot.id} />
                  <button className="btn small danger" type="submit">Cancel class</button>
                </form>
              ) : null}

              <div>
                <h3>Students</h3>
                {booked.length === 0 ? <p className="muted">No students booked yet.</p> : null}
                {booked.map((booking: AnyRow) => (
                  <div className="inline" key={booking.id} style={{ marginBottom: 8 }}>
                    <span>{booking.student?.full_name || booking.student?.email || "Student"}</span>
                    <form action={markAttendance} className="inline">
                      <input type="hidden" name="booking_id" value={booking.id} />
                      <input type="hidden" name="status" value="completed" />
                      <button className="btn small secondary">Completed</button>
                    </form>
                    <form action={markAttendance} className="inline">
                      <input type="hidden" name="booking_id" value={booking.id} />
                      <input type="hidden" name="status" value="absent" />
                      <button className="btn small secondary">Absent</button>
                    </form>
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
