import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-serif text-xl ${light ? "text-white" : "text-navy"}`}>
      <span aria-hidden className="inline-block size-3 rounded-full bg-saffron" />
      Plenary
    </Link>
  );
}

export function AuthCard({ title, lead, children, footer }: { title: string; lead?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center"><Brand /></div>
        <section className="rounded-xl border border-line bg-card p-6 shadow-sm sm:p-8">
          <h1 className="font-serif text-3xl text-navy">{title}</h1>
          {lead ? <p className="mt-2 text-sm text-muted">{lead}</p> : null}
          <div className="mt-6">{children}</div>
        </section>
        {footer ? <div className="mt-4 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </main>
  );
}

export function Field({
  label, name, error, hint, ...props
}: { label: string; name: string; error?: string[]; hint?: string } & ComponentProps<"input">) {
  const id = `f-${name}`;
  const describedBy = [error?.length ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <input
        id={id}
        name={name}
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={describedBy}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-ink outline-none transition focus:border-navy aria-invalid:border-bad"
        {...props}
      />
      {hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error?.length ? <p id={`${id}-err`} className="mt-1 text-xs text-bad">{error[0]}</p> : null}
    </div>
  );
}

export function SubmitButton({ children, pending }: { children: ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-navy px-4 py-2.5 font-medium text-white transition hover:bg-navy-2 disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "ok" | "bad"; children: ReactNode }) {
  const cls = tone === "ok" ? "border-ok/30 bg-ok/5 text-ok" : tone === "bad" ? "border-bad/30 bg-bad/5 text-bad" : "border-saffron/50 bg-saffron/10 text-saffron-ink";
  return <div role={tone === "bad" ? "alert" : "status"} className={`mb-4 rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function AuthSkeleton() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10" aria-busy="true">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center"><Brand /></div>
        <div className="h-72 animate-pulse rounded-xl border border-line bg-card" />
      </div>
    </main>
  );
}
