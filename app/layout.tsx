import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pilates Studio Booking",
  description: "Simple Pilates class booking MVP",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Force this layout to be rendered per-request so the nav reflects login/logout immediately.
  await cookies();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="vi">
      <body>
        <nav className="nav">
          <Link href="/" className="brand">Pilates Studio</Link>
          <div className="nav-links">
            {user ? (
              <>
                <Link href="/dashboard" className="btn small secondary">Dashboard</Link>
                <Link href="/logout" className="btn small secondary">Logout</Link>
              </>
            ) : (
              <Link href="/login" className="btn small secondary">Login</Link>
            )}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
