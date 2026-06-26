import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage(props: { searchParams?: Promise<Record<string, string>> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const searchParams = props.searchParams ? await props.searchParams : {};
  const error = searchParams?.error;

  return (
    <main className="container">
      <div className="grid two">
        <section className="card">
          <h1>Đăng nhập</h1>
          <p className="muted">Dùng email do admin phòng tập cấp cho bạn.</p>
          {error ? <p className="error">{error}</p> : null}
          <form className="form" action={signIn}>
            <label>
              Email
              <input name="email" type="email" required placeholder="ban@example.com" />
            </label>
            <label>
              Mật khẩu
              <input name="password" type="password" required placeholder="Nhập mật khẩu" />
            </label>
            <button className="btn" type="submit">Đăng nhập</button>
          </form>
          <p className="muted" style={{ marginTop: 12 }}>
            <Link href="/forgot-password">Quên mật khẩu?</Link>
          </p>
        </section>
        <section className="card">
          <h2>Không mở đăng ký công khai</h2>
          <p className="muted">
            Đây là hệ thống nội bộ của phòng tập. Admin sẽ tạo tài khoản cho giáo viên và học viên,
            sau đó gán đúng quyền sử dụng.
          </p>
        </section>
      </div>
    </main>
  );
}
