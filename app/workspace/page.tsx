import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand, Notice } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Workspace" };

async function Inner({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in?next=/workspace");

  // RLS: these only return the signed-in person's own rows.
  const [{ data: person }, { data: emails }, { data: roles }] = await Promise.all([
    supabase.from("persons").select("id, display_name, orcid, country").eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("person_emails").select("email, is_primary, verified_at").order("is_primary", { ascending: false }),
    supabase.from("venue_members").select("role, venues(name, slug)"),
  ]);
  const { notice } = await searchParams;

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between bg-navy px-4 py-3 sm:px-6">
        <Brand light />
        <form action={signOut}>
          <button className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white">Sign out</button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {notice === "password-changed" ? <Notice tone="ok">Password changed. Other devices were signed out.</Notice> : null}
        <h1 className="font-serif text-4xl text-navy">Welcome{person?.display_name ? `, ${person.display_name}` : ""}</h1>
        <p className="mt-1 text-muted">Your home for submissions, reviews and events.</p>

        <section className="mt-6 rounded-xl border border-line bg-card p-5">
          <h2 className="font-medium text-navy">Your emails</h2>
          <ul className="mt-2 text-sm">
            {(emails ?? []).map((e) => (
              <li key={e.email} className="flex items-center gap-2 py-1">
                <span className="font-mono">{e.email}</span>
                {e.is_primary ? <span className="rounded bg-saffron/20 px-1.5 text-xs text-saffron-ink">primary</span> : null}
                {e.verified_at ? <span className="text-xs text-ok">verified</span> : <span className="text-xs text-muted">unverified</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-line bg-card p-5">
          <h2 className="font-medium text-navy">Your roles</h2>
          {roles && roles.length ? (
            <ul className="mt-2 text-sm">{roles.map((r, i) => <li key={i}>{r.role}</li>)}</ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No events yet. Find an open call to submit, or accept a reviewer invitation.</p>
          )}
        </section>
        {/* TODO: replace with the full Workspace (WS01) once the submission module lands. */}
      </main>
    </div>
  );
}

export default function Page(props: { searchParams: Promise<{ notice?: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-paper" aria-busy="true" />}>
      <Inner {...props} />
    </Suspense>
  );
}
