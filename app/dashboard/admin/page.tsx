import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatTimeRange, nowIso } from "@/lib/time";
import { createUserByAdmin, inviteUser, setUserActive, updateMembership, updateUserContact, updateUserRole } from "@/app/actions/admin";

type AnyRow = Record<string, any>;

export default async function AdminDashboardPage(props: { searchParams?: Promise<Record<string, string>> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const { supabase } = await requireRole(["admin"]);

  const [{ data: profiles }, { data: memberships }, { data: slots }, { data: history }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("student_memberships").select("*"),
    supabase
      .from("teacher_slots")
      .select("*, teacher:profiles!teacher_slots_teacher_id_fkey(full_name,email), bookings(id,status, student:profiles!bookings_student_id_fkey(full_name,email))")
      .gte("starts_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("*, student:profiles!bookings_student_id_fkey(full_name,email), slot:teacher_slots!bookings_slot_id_fkey(starts_at,ends_at, teacher:profiles!teacher_slots_teacher_id_fkey(full_name,email))")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const students = (profiles || []).filter((p: AnyRow) => p.role === "student");

  return (
    <main className="container">
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Admin dashboard</h1>
          <p className="muted">Manage users, session balance, class schedule, and attendance history.</p>
          {searchParams?.created === "1" ? <p className="success">User created. Share the email and initial password with them, then ask them to change password later.</p> : null}
          {searchParams?.invited === "1" ? <p className="success">Invite email sent.</p> : null}
        </div>
        <Link className="btn secondary" href="/logout">Logout</Link>
      </div>

      <div className="grid two">
        <section className="card">
          <h2>Create user</h2>
          <p className="muted">Default MVP flow: create the account directly, no Supabase email is sent, so it avoids email rate limits.</p>
          <form className="form" action={createUserByAdmin}>
            <label>Full name<input name="full_name" required /></label>
            <label>Email<input name="email" type="email" required /></label>
            <label>Phone<input name="phone" type="tel" required placeholder="0901234567" /></label>
            <label>Initial password<input name="password" type="text" required minLength={8} placeholder="At least 8 characters" /></label>
            <label>
              Role
              <select name="role" defaultValue="student">
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button className="btn" type="submit">Create user</button>
          </form>

          <details style={{ marginTop: 16 }}>
            <summary className="muted">Optional: send Supabase invite email instead</summary>
            <form className="form" action={inviteUser} style={{ marginTop: 12 }}>
              <label>Full name<input name="full_name" required /></label>
              <label>Email<input name="email" type="email" required /></label>
              <label>Phone<input name="phone" type="tel" required placeholder="0901234567" /></label>
              <label>
                Role
                <select name="role" defaultValue="student">
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button className="btn secondary" type="submit">Send invite email</button>
            </form>
          </details>
        </section>

        <section className="card">
          <h2>Today</h2>
          <p className="muted">Current time: {formatDateTime(nowIso())}</p>
          <div className="grid three">
            <div><div className="kpi">{profiles?.length || 0}</div><p className="muted">Users</p></div>
            <div><div className="kpi">{slots?.length || 0}</div><p className="muted">Recent slots</p></div>
            <div><div className="kpi">{history?.length || 0}</div><p className="muted">Recent bookings</p></div>
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Users and roles</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(profiles || []).map((p: AnyRow) => (
                <tr key={p.id}>
                  <td>
                    <form className="form" action={updateUserContact}>
                      <input type="hidden" name="id" value={p.id} />
                      <input name="full_name" defaultValue={p.full_name || ""} required />
                      <input name="phone" type="tel" defaultValue={p.phone || ""} required placeholder="Phone" />
                      <button className="btn small secondary">Save contact</button>
                    </form>
                  </td>
                  <td>{p.email}</td>
                  <td>{p.phone || "-"}</td>
                  <td><span className="badge">{p.role}</span></td>
                  <td>{p.active ? <span className="badge green">active</span> : <span className="badge red">inactive</span>}</td>
                  <td className="inline">
                    <form className="inline" action={updateUserRole}>
                      <input type="hidden" name="id" value={p.id} />
                      <select name="role" defaultValue={p.role}>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button className="btn small secondary">Save role</button>
                    </form>
                    <form action={setUserActive}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                      <button className="btn small secondary">{p.active ? "Deactivate" : "Activate"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Student session balance</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Total</th><th>Remaining</th><th>Expires</th><th>Notes</th><th>Action</th></tr></thead>
            <tbody>
              {students.map((student: AnyRow) => {
                const member = (memberships || []).find((m: AnyRow) => m.student_id === student.id) || {};
                return (
                  <tr key={student.id}>
                    <td>{student.full_name}<br /><span className="muted">{student.email}</span><br /><span className="muted">{student.phone || "No phone"}</span></td>
                    <td colSpan={5}>
                      <form className="form" action={updateMembership}>
                        <input type="hidden" name="student_id" value={student.id} />
                        <div className="form-row">
                          <label>Total<input name="total_sessions" type="number" min="0" defaultValue={member.total_sessions || 0} /></label>
                          <label>Remaining<input name="remaining_sessions" type="number" min="0" defaultValue={member.remaining_sessions || 0} /></label>
                        </div>
                        <div className="form-row">
                          <label>Expires on<input name="expires_on" type="date" defaultValue={member.expires_on || ""} /></label>
                          <label>Notes<input name="notes" defaultValue={member.notes || ""} /></label>
                        </div>
                        <button className="btn small">Save balance</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Schedule overview</h2>
        {(slots || []).map((slot: AnyRow) => {
          const booked = (slot.bookings || []).filter((b: AnyRow) => b.status === "booked");
          return (
            <div className="slot" key={slot.id}>
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <strong>{formatTimeRange(slot.starts_at, slot.ends_at)}</strong>
                <span className={slot.status === "open" ? "badge green" : "badge red"}>{slot.status}</span>
              </div>
              <p className="muted">Teacher: {slot.teacher?.full_name || slot.teacher?.email || "-"} | Capacity: {booked.length}/{slot.capacity}</p>
              <p>{booked.length ? booked.map((b: AnyRow) => b.student?.full_name || b.student?.email).join(", ") : "No students yet"}</p>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2>Attendance and booking history</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Class</th><th>Teacher</th><th>Student</th><th>Status</th><th>Booked at</th></tr></thead>
            <tbody>
              {(history || []).map((b: AnyRow) => (
                <tr key={b.id}>
                  <td>{b.slot ? formatTimeRange(b.slot.starts_at, b.slot.ends_at) : "-"}</td>
                  <td>{b.slot?.teacher?.full_name || b.slot?.teacher?.email || "-"}</td>
                  <td>{b.student?.full_name || b.student?.email || "-"}</td>
                  <td><span className="badge">{b.status}</span></td>
                  <td>{formatDateTime(b.booked_at || b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
