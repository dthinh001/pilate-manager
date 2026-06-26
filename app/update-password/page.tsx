import { updatePassword } from "@/app/actions/auth";

export default async function UpdatePasswordPage(props: { searchParams?: Promise<Record<string, string>> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const error = searchParams?.error;

  return (
    <main className="container">
      <section className="card narrow">
        <h1>Tạo mật khẩu mới</h1>
        <p className="muted">Mật khẩu mới cần có ít nhất 8 ký tự.</p>
        {error ? <p className="error">{error}</p> : null}
        <form className="form" action={updatePassword}>
          <label>
            Mật khẩu mới
            <input name="password" type="password" required minLength={8} />
          </label>
          <button className="btn" type="submit">Lưu mật khẩu</button>
        </form>
      </section>
    </main>
  );
}
