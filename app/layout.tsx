import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đặt lịch Pilates",
  description: "MVP đặt lịch tập cho phòng Pilates",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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
                <Link href="/dashboard" className="btn small secondary">Bảng điều khiển</Link>
                <Link href="/logout" className="btn small secondary">Đăng xuất</Link>
              </>
            ) : (
              <Link href="/login" className="btn small secondary">Đăng nhập</Link>
            )}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
