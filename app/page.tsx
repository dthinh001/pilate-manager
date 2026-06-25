import Link from "next/link";

export default function HomePage() {
  const zaloUrl = process.env.NEXT_PUBLIC_ZALO_URL || "https://zalo.me/";

  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">Pilates booking MVP</span>
          <h1>Book your Pilates class with ease.</h1>
          <p>
            A simple studio website for students to book classes, teachers to create schedules,
            and admins to manage sessions and attendance.
          </p>
          <div className="actions">
            <a href={zaloUrl} className="btn" target="_blank" rel="noreferrer">
              Register trial class via Zalo
            </a>
            <Link href="/login" className="btn secondary">Login</Link>
          </div>
        </div>

        <div className="hero-grid" aria-label="Studio images placeholder">
          <div className="image-card" />
          <div className="image-card" />
          <div className="image-card" />
        </div>
      </section>
    </main>
  );
}
