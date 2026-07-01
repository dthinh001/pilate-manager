import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import studioContent from "@/content/studio.json";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: studioContent.studioName,
  description: "MVP đặt lịch tập cho phòng Pilates",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await cookies();

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  return (
    <html lang="vi">
      <body>
        <nav className="nav">
          <Link href="/" className="brand" aria-label="Về trang chủ">
            <img className="brand-logo" src={studioContent.logo} alt="" />
            <span>{studioContent.studioName}</span>
          </Link>
          <div className="nav-links">
            {user ? (
              <>
                <Link href="/dashboard" className="btn small secondary">Dashboard</Link>
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
