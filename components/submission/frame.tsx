import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SavedAgo, StepRail, TitleBand, WizardHeader, WizardLayout } from "@/components/submission/shell";
import { getMe } from "@/lib/auth/me";
import { STEPS, loadSubmission, type Ctx, type StepKey } from "@/lib/submission/data";

export const initialsOf = (name: string, email: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? email[0] ?? "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
};

/** Load a submission for a wizard step; send people to sign-in, 404 or the status page as needed. */
export async function requireCtx(id: string, step: StepKey | "status" | "submitted"): Promise<Ctx> {
  const me = await getMe();
  if (!me) redirect(`/sign-in?next=${encodeURIComponent(`/submissions/${id}${step === "status" ? "" : `/${step}`}`)}`);
  const ctx = await loadSubmission(id);
  if (!ctx) notFound();
  if (step !== "status" && step !== "submitted" && !ctx.editable) redirect(`/submissions/${id}`);
  return ctx;
}

export function SubmissionFrame({ ctx, step, children, aside }: { ctx: Ctx; step: StepKey; children: ReactNode; aside?: ReactNode }) {
  const generatedAt = new Date(ctx.sub.updatedAt).toISOString();
  const lastDone = STEPS.reduce((m, s) => (ctx.done[s.key] ? Math.max(m, s.n) : m), 0);
  const reachable = Math.max(ctx.sub.draftStep, lastDone + 1, STEPS.find((s) => s.key === step)!.n);
  const idx = ctx.drafts.findIndex((d) => d.id === ctx.sub.id);
  const submitted = ctx.sub.stage !== "draft";
  const name = ctx.me.person ? `${ctx.me.person.given_name} ${ctx.me.person.family_name}` : ctx.me.email;
  return (
    <WizardLayout
      header={<WizardHeader initials={initialsOf(name, ctx.me.email)} right={<SavedAgo at={ctx.sub.updatedAt} generatedAt={generatedAt} label={submitted ? `Submitted · #${String(ctx.sub.number).padStart(4, "0")} · saved` : "Draft saved"} />} />}
      band={<TitleBand crumb={submitted ? `Submission #${String(ctx.sub.number).padStart(4, "0")}` : "New submission"} title={submitted ? "Edit submission" : "New submission"} venue={ctx.venue} generatedAt={generatedAt} />}
      rail={
        <StepRail
          rail={{ done: ctx.done, current: step, reachable, base: `/submissions/${ctx.sub.id}` }}
          draft={{ title: ctx.sub.title, venue: ctx.venue.acr, index: idx >= 0 ? idx + 1 : 1, total: Math.max(ctx.drafts.length, 1), switchHref: "/workspace/submissions" }}
        />
      }
      aside={aside}
    >
      {children}
    </WizardLayout>
  );
}
