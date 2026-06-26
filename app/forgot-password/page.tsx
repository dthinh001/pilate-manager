import Link from "next/link";
import { sendPasswordReset } from "@/app/actions/auth";

export default async function ForgotPasswordPage(props: { searchParams?: Promise<Record<string, string>> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const error = searchParams?.error;
  const sent = searchParams?.sent === "1";

  return (
    <main className="container">
      <section className="card narrow">
        <h1>Đặt lại mật khẩu</h1>
        <p className="muted">
          Nhập email tài khoản. Hệ thống sẽ gửi link đặt lại mật khẩu về email đó.
        </p>
        {error ? <p className="error">{error}</p> : null}
        {sent ? <p className="success">Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư và mục spam.</p> : null}
        <form className="form" action={sendPasswordReset}>
          <label>
            Email
            <input name="email" type="email" required placeholder="ban@example.com" />
          </label>
          <button className="btn" type="submit">Gửi link đặt lại mật khẩu</button>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>
          <Link href="/login">Quay lại đăng nhập</Link>
        </p>
      </section>
    </main>
  );
}
