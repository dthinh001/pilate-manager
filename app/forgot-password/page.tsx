import Link from "next/link";
import { sendPasswordReset } from "@/app/actions/auth";

export default async function ForgotPasswordPage(props: { searchParams?: Promise<Record<string, string>> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const error = searchParams?.error;
  const sent = searchParams?.sent === "1";

  return (
    <main className="container">
      <section className="card narrow">
        <h1>Reset password</h1>
        <p className="muted">
          Enter your email. We will send a reset link that opens the password update page.
        </p>
        {error ? <p className="error">{error}</p> : null}
        {sent ? <p className="success">Reset email sent. Please check your inbox and spam folder.</p> : null}
        <form className="form" action={sendPasswordReset}>
          <label>
            Email
            <input name="email" type="email" required placeholder="you@example.com" />
          </label>
          <button className="btn" type="submit">Send reset link</button>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>
          <Link href="/login">Back to login</Link>
        </p>
      </section>
    </main>
  );
}
