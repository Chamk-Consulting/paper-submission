import Link from "next/link";
import { Brand } from "@/components/ui";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

async function getOpenVenues() {
  "use cache";
  cacheLife("minutes");
  cacheTag("venues");
  // RLS: the anon role only sees published venues.
  const { data } = await createPublicClient()
    .from("venues")
    .select("slug, name, short_name, starts_on, ends_on, location")
    .eq("is_published", true)
    .order("starts_on", { ascending: true })
    .limit(50);
  return data ?? [];
}

export default async function Home() {
  const venues = await getOpenVenues();
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Brand />
        <nav className="flex gap-2 text-sm">
          <Link href="/sign-in" className="rounded-md px-3 py-2 text-navy hover:bg-white">Sign in</Link>
          <Link href="/sign-up" className="rounded-md bg-navy px-3 py-2 text-white hover:bg-navy-2">Create account</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-8">
        <section className="py-12">
          <p className="font-mono text-xs uppercase tracking-widest text-saffron-ink">Paper submission &amp; review</p>
          <h1 className="mt-3 max-w-2xl font-serif text-5xl leading-tight text-navy">Open calls for papers</h1>
          <p className="mt-3 max-w-xl text-muted">Submit to conferences, workshops and journals with one account.</p>
        </section>
        {venues.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {venues.map((v) => (
              <li key={v.slug} className="rounded-xl border border-line bg-card p-5">
                <p className="font-mono text-xs text-muted">{v.short_name ?? v.slug}</p>
                <h2 className="mt-1 font-serif text-xl text-navy">{v.name}</h2>
                <p className="mt-1 text-sm text-muted">{[v.location, v.starts_on].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-card p-8 text-center text-muted">No open calls yet.</p>
        )}
      </main>
    </div>
  );
}
