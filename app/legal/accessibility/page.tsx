import type { Metadata } from "next";
import { Brand } from "@/components/ui";
import { site } from "@/lib/config/site";

export const metadata: Metadata = { title: "Accessibility" };

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Brand />
      <h1 className="mt-6 font-serif text-4xl text-navy">Accessibility</h1>
      {/* TODO(legal): final text reviewed by counsel; TODO(domain): contact address. */}
      <p className="mt-4 text-muted">Draft — operated by {site.legalName}. Final text will be published before launch.</p>
    </main>
  );
}
