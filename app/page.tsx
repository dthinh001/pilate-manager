import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import studioContent from "@/content/studio.json";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await cookies();
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  const zaloUrl = process.env.NEXT_PUBLIC_ZALO_URL || "https://zalo.me/";

  return (
    <main className="container">
      <section className="hero">
        <div>
          <span className="badge">{studioContent.hero.badge}</span>
          <h1>{studioContent.hero.title}</h1>
          <p>{studioContent.hero.description}</p>
          <div className="actions">
            <a href={zaloUrl} className="btn" target="_blank" rel="noreferrer">
              {studioContent.hero.trialButtonText}
            </a>
            {user ? (
              <Link href="/dashboard" className="btn secondary">{studioContent.hero.dashboardButtonText}</Link>
            ) : (
              <Link href="/login" className="btn secondary">{studioContent.hero.loginButtonText}</Link>
            )}
          </div>
        </div>

        <div className="hero-grid" aria-label="Ảnh minh họa phòng tập">
          {studioContent.hero.images.map((image) => (
            <div className="image-card" key={image.src}>
              <img src={image.src} alt={image.alt} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
