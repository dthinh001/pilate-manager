import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pilates Studio Booking",
  description: "Simple Pilates class booking MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <nav className="nav">
          <Link href="/" className="brand">Pilates Studio</Link>
          <div className="nav-links">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/login" className="btn small secondary">Login</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
