import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await cookies();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const zaloUrl = process.env.NEXT_PUBLIC_ZALO_URL || "https://zalo.me/";

  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">Đặt lịch Pilates</span>
          <h1>Đặt lịch tập Pilates dễ dàng.</h1>
          <p>
            Website đơn giản cho phòng tập: học viên đặt lịch, giáo viên tạo lịch dạy,
            admin quản lý tài khoản, số buổi và lịch sử điểm danh.
          </p>
          <div className="actions">
            <a href={zaloUrl} className="btn" target="_blank" rel="noreferrer">
              Đăng ký tập thử qua Zalo
            </a>
            {user ? (
              <Link href="/dashboard" className="btn secondary">Vào bảng điều khiển</Link>
            ) : (
              <Link href="/login" className="btn secondary">Đăng nhập</Link>
            )}
          </div>
        </div>

        <div className="hero-grid" aria-label="Ảnh minh họa phòng tập">
          <div className="image-card" />
          <div className="image-card" />
          <div className="image-card" />
        </div>
      </section>
    </main>
  );
}
