import { updatePassword } from "@/app/actions/auth";

export default async function UpdatePasswordPage(props: { searchParams?: Promise<Record<string, string>> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const error = searchParams?.error;

  return (
    <main className="container">
      <section className="card">
        <h1>Set your password</h1>
        <p className="muted">Create a password for your studio account.</p>
        {error ? <p className="error">{error}</p> : null}
        <form className="form" action={updatePassword}>
          <label>
            New password
            <input name="password" type="password" required minLength={8} />
          </label>
          <button className="btn" type="submit">Save password</button>
        </form>
      </section>
    </main>
  );
}
