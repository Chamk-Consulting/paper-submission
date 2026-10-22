import Link from "@/components/site/link";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/shell";
import { getT } from "@/lib/i18n/server";
import { SETUP_GROUPS, groupStatus, type EventCtx } from "@/lib/manage/data";

/* Organizer page frame (canvas EM02–EM44): workspace shell + event sidebar + page head with "Viewing as". */

export { ui } from "@/components/manage/ui";


export const STATUS_DOT: Record<string, string> = { ready: "#18744F", in_progress: "#F2A93B", not_started: "#B7BDC9" };
export const STATUS_LABEL: Record<string, string> = { ready: "Ready", in_progress: "In progress", not_started: "Not started" };

export async function ManagePage({ ctx, active, crumb, title, sub, actions, children, wide = false }: {
  ctx: EventCtx; active: string; crumb?: ReactNode; title: string; sub?: string; actions?: ReactNode; children: ReactNode; wide?: boolean;
}) {
  const t = await getT();
  return (
    <WorkspaceShell ctx={ctx.ws} active={`m:${active}`} event={{ slug: ctx.venue.slug, name: ctx.label, roleLabel: ctx.roleLabel }}>
      <div className={wide ? "" : "max-w-[1180px]"}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 font-mono text-[12px] text-[#4A5263]">{crumb ?? ctx.label}</p>
            <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{title}</h1>
            {sub ? <p className="mt-1.5 text-[#4A5263]">{sub}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {actions}
            <span className="inline-flex h-[34px] items-center gap-2 rounded-full border border-[#DADDE3] bg-white px-3 text-[13px]">
              <span aria-hidden className="size-2 rounded-full bg-[#F2A93B]" />
              {t("Viewing as")} <strong>{t(ctx.roleLabel)}</strong> · {ctx.label}
              <Link href="/manage/roles" className="text-[12px]">{t("switch")} ▾</Link>
            </span>
          </div>
        </div>
        <div className="mt-[22px]">{children}</div>
      </div>
    </WorkspaceShell>
  );
}

/** Setup page: sub-nav of setup sections on the left, content on the right. */
export async function SetupLayout({ ctx, current, children }: { ctx: EventCtx; current: string; children: ReactNode }) {
  const t = await getT();
  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row">
      <nav aria-label={t("Setup sections")} className="flex w-full flex-col gap-0.5 lg:w-[230px] lg:flex-none">
        <Link href={`/manage/${ctx.venue.slug}/setup`} className="mb-2 text-[13px]">← {t("Setup checklist")}</Link>
        {SETUP_GROUPS.map((g) => {
          const st = groupStatus(ctx, g.sections);
          const on = g.key === current;
          return (
            <Link key={g.key} href={`/manage/${ctx.venue.slug}/setup/${g.path}`} aria-current={on ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-[6px] border px-2.5 py-2 text-[#121826] no-underline ${on ? "border-[#DADDE3] bg-white" : "border-transparent hover:bg-white"}`}>
              <span aria-hidden className="size-2.5 flex-none rounded-full" style={{ background: STATUS_DOT[st] }} />
              <span className={`text-[14px] ${on ? "font-semibold" : ""}`}>{t(g.label)}<span className="block text-[11px] text-[#4A5263]">{t(STATUS_LABEL[st])}</span></span>
            </Link>
          );
        })}
      </nav>
      <div className="w-full min-w-0 flex-auto">{children}</div>
    </div>
  );
}

export function Lock({ on, label }: { on: boolean; label: string }) {
  return on ? <span className="ml-2 inline-flex items-center gap-1 rounded-[3px] bg-[#EEF0EC] px-1.5 py-px font-mono text-[10px] uppercase text-[#4A5263]" title={label}>🔒 {label}</span> : null;
}
