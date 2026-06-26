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
          <h1>Login</h1>
          <p className="muted">Use the email account created by the studio admin.</p>
          {error ? <p className="error">{error}</p> : null}
          <form className="form" action={signIn}>
            <label>
              Email
              <input name="email" type="email" required placeholder="you@example.com" />
            </label>
            <label>
              Password
              <input name="password" type="password" required placeholder="Your password" />
            </label>
            <button className="btn" type="submit">Login</button>
          </form>
          <p className="muted" style={{ marginTop: 12 }}>
            <Link href="/forgot-password">Forgot password?</Link>
          </p>
        </section>
        <section className="card">
          <h2>No public sign up</h2>
          <p className="muted">
            This MVP is private. Admin creates accounts for teachers and students, then assigns a role.
          </p>
        </section>
      </div>
    </main>
  );
}
