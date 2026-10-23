import Link from "@/components/site/link";
import type { ReactNode } from "react";
import type { T } from "@/lib/i18n/translate";
import { ui } from "@/components/manage/ui";
import type { AdminPerson, AdminTab, AdminVenue, AuditRow, MaintenanceWindow, Overview, SupportItem } from "@/lib/admin/data";
import { ApprovalToggle, CancelMaintenance, LockForm, MaintenanceForm, PersonAction, ReplyForm, VenueDecision } from "@/components/admin/forms";

type TT = T & { intl: string };

const fmt = (t: TT, at: string | null, withTime = true) =>
  at ? new Intl.DateTimeFormat(t.intl, { dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}), timeZone: "UTC" }).format(new Date(at)) + (withTime ? " UTC" : "") : "—";

const STATUS_TAG: Record<string, [string, string, string]> = {
  new: ["NEW", "#FBEFDD", "#7A4508"], open: ["REPLIED", "#E6EDFC", "#1F47A8"], closed: ["SOLVED", "#E1F3EA", "#14603F"],
  pending: ["PENDING", "#FBEFDD", "#7A4508"], info: ["INFO REQUESTED", "#EEF0EC", "#4A5263"], approved: ["APPROVED", "#E1F3EA", "#14603F"],
};
function Tag({ t, k }: { t: TT; k: string }) {
  const [label, bg, ink] = STATUS_TAG[k] ?? [k.toUpperCase(), "#EEF0EC", "#4A5263"];
  return <span className={ui.tag} style={{ background: bg, color: ink }}>{t(label)}</span>;
}

/* ---------------------------------------------------------------- shell */
export function AdminShell({ t, name, tab, overview, children }: { t: TT; name: string; tab: AdminTab; overview: Overview; children: ReactNode }) {
  const nav: [AdminTab, string, number | null][] = [
    ["support", "Support inbox", overview.support_new], ["venues", "Venue approvals", overview.venues_pending], ["people", "Find a person", null], ["status", "System status", null],
    ["payments", "Payments", null], ["invoices", "Invoices", null], ["payouts", "Payouts", null],
  ];
  return (
    <div className="flex min-h-[calc(100dvh-60px)] flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <div className="border-b border-[#DADDE3] bg-white">
        <div className="mx-auto box-border flex min-h-11 w-full max-w-[1440px] flex-wrap items-center gap-3 px-6 py-1.5">
          <span className="rounded-[3px] bg-[#B3261E] px-2 py-0.5 font-mono text-[11px] tracking-[0.06em] text-white">{t("PLATFORM ADMIN")}</span>
          <span className="ml-auto text-[14px] text-[#4A5263]">{t("Signed in as {name}", { name })}</span>
          <Link href="/workspace" className="text-[14px] font-semibold text-[#1F47A8]">{t("Leave admin")}</Link>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1440px] flex-auto flex-wrap">
        <nav aria-label={t("Admin")} className="box-border flex w-full flex-col gap-0.5 border-b border-[#DADDE3] bg-white px-3 py-4 md:w-[220px] md:flex-none md:border-b-0 md:border-r min-[1441px]:border-l">
          {nav.map(([k, label, n]) => (
            <Link key={k} href={`/admin?tab=${k}`} aria-current={tab === k ? "page" : undefined}
              className={`flex h-10 items-center justify-between rounded-[6px] px-3 text-[14px] text-[#121826] no-underline hover:bg-[#F5F6F3] ${tab === k ? "bg-[#E6EDFC] font-semibold" : ""}`}>
              {t(label)}{n ? <span className="font-mono text-[12px] text-[#4A5263]">{n}</span> : null}
            </Link>
          ))}
          <p className="m-0 mt-auto border-t border-[#EEF0EC] px-3 pt-3 text-[12px] text-[#4A5263]">{t("Every admin action is logged and visible to the person it concerns.")}</p>
        </nav>
        <main className="box-border min-w-0 flex-[999_1_560px] px-5 py-8 sm:px-10">{children}</main>
      </div>
    </div>
  );
}

function Title({ t, title, sub, right }: { t: TT; title: string; sub: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Admin")}</p>
        <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t(title)}</h1>
        <p className="mt-1.5 text-[#4A5263]">{t(sub)}</p>
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------------------------------------- support */
export function SupportView({ t, items, selected, now }: { t: TT; items: SupportItem[]; selected: string | null; now: number }) {
  const cur = items.find((i) => i.id === selected) ?? items[0] ?? null;
  const ago = (at: string) => {
    const m = Math.max(0, Math.round((now - Date.parse(at)) / 60000));
    if (m < 60) return t("{n} min ago", { n: m });
    if (m < 60 * 24) return t("{n} h ago", { n: Math.round(m / 60) });
    return fmt(t, at, false);
  };
  return (
    <>
      <Title t={t} title="Support inbox" sub="Messages from the contact form and account-help requests." />
      {items.length === 0 ? <p className={`${ui.card} mt-5 text-[#4A5263]`}>{t("No messages yet.")}</p> : (
        <div className="mt-5 flex flex-wrap items-start gap-5">
          <section aria-label={t("Messages")} className="flex-[1_1_320px] overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
            {items.map((m) => (
              <Link key={m.id} href={`/admin?tab=support&id=${m.id}`} aria-current={cur?.id === m.id ? "true" : undefined}
                className={`block border-b border-[#EEF0EC] px-4 py-3 text-[#121826] no-underline hover:bg-[#F7F8F6] ${cur?.id === m.id ? "bg-[#FBFCFF]" : ""}`}>
                <span className="flex justify-between gap-2"><span className="font-mono text-[12px] text-[#4A5263]">{m.reference}</span><Tag t={t} k={m.status} /></span>
                <span className="block font-semibold">{m.subject}</span>
                <span className="block text-[13px] text-[#4A5263]">{m.name ?? m.email ?? "—"} · {ago(m.created_at)}</span>
              </Link>
            ))}
          </section>
          {cur ? (
            <section className={`${ui.card} min-w-0 flex-[999_1_420px]`}>
              <p className={ui.kicker}>{cur.reference} · {cur.topic}</p>
              <h2 className="mt-1.5 text-[20px] font-semibold">{cur.subject}</h2>
              <p className="mt-0.5 text-[14px] text-[#4A5263]">{[cur.name, cur.email].filter(Boolean).join(" · ")} · {fmt(t, cur.created_at)}</p>
              <p className="mt-3.5 whitespace-pre-line text-[15px] leading-[1.6]">{cur.body}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                <span className={`rounded-[3px] px-2 py-0.5 ${cur.allow_access ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#EEF0EC] text-[#4A5263]"}`}>{cur.allow_access ? t("Allowed support to look at the account") : t("Did not allow account access")}</span>
                {cur.plenary_id ? <Link href={`/admin?tab=people&q=${encodeURIComponent(cur.plenary_id)}`} className="rounded-[3px] bg-[#EEF0EC] px-2 py-0.5 text-[#121826]">{t("Account: {id}", { id: cur.plenary_id })}</Link> : null}
              </div>
              {cur.replies.length ? (
                <ol className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
                  {cur.replies.map((r, i) => (
                    <li key={i} className="rounded-[6px] bg-[#F7F8F6] px-3 py-2 text-[14px]">
                      <span className="block text-[12px] text-[#4A5263]">{fmt(t, r.at)} · {r.emailed ? t("emailed") : t("saved only")}</span>
                      <span className="whitespace-pre-line">{r.body}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              <ReplyForm source={cur.source} id={cur.id} name={cur.name} closed={cur.status === "closed"} />
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- venues */
export function VenuesView({ t, venues, requireApproval }: { t: TT; venues: AdminVenue[]; requireApproval: boolean }) {
  return (
    <>
      <Title t={t} title="Venue approvals" sub="New events are checked before they can open submissions: real organizer, real conference." />
      <div className={`${ui.card} mt-5 px-[18px]! py-3.5!`}><ApprovalToggle on={requireApproval} /></div>
      <section className="mt-4 overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
        <div className="overflow-x-auto">
          <table className={ui.table}>
            <thead><tr><th scope="col" className={ui.th}>{t("Event")}</th><th scope="col" className={ui.th}>{t("Organizer")}</th><th scope="col" className={ui.th}>{t("Checks")}</th><th scope="col" className={ui.th}>{t("Status")}</th><th scope="col" className={ui.th}>{t("Decision")}</th></tr></thead>
            <tbody>
              {venues.length === 0 ? <tr><td colSpan={5} className={`${ui.td} text-[#4A5263]`}>{t("No events yet.")}</td></tr> : venues.map((v) => (
                <tr key={v.id}>
                  <td className={ui.td}><strong>{v.short_name ?? v.name}</strong><span className="block text-[13px] text-[#4A5263]">{[v.starts_on ? fmt(t, v.starts_on, false) : null, v.location].filter(Boolean).join(" · ") || "—"}</span><span className="block font-mono text-[12px] text-[#4A5263]">/{v.slug} · {t("{n} papers", { n: v.papers })}</span></td>
                  <td className={ui.td}>{v.owner_name ?? "—"}<span className="block text-[13px] text-[#4A5263]">{v.owner_email ?? ""}</span></td>
                  <td className={`${ui.td} text-[13px]`}>
                    <span className="block">{v.owner_email ? (v.personal_email ? `! ${t("Personal email")}` : `✓ ${t("Institutional email")}`) : `! ${t("No owner")}`}</span>
                    <span className="block">{v.website ? <a href={v.website} target="_blank" rel="noreferrer noopener">✓ {t("Website")}</a> : `! ${t("No website")}`}</span>
                    {v.approval_note && v.status !== "approved" ? <span className="block text-[#4A5263]">“{v.approval_note}”</span> : null}
                  </td>
                  <td className={ui.td}><Tag t={t} k={v.status} />{v.approved_at ? <span className="block text-[12px] text-[#4A5263]">{fmt(t, v.approved_at, false)}</span> : null}</td>
                  <td className={ui.td}><VenueDecision id={v.id} status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- people */
const ROLE: Record<string, string> = { owner: "Owner", chair: "General chair", program_chair: "Program chair", deputy_chair: "Deputy chair", associate_editor: "Associate editor", reviewer: "Reviewer", staff: "Staff", author: "Author" };
export function PeopleView({ t, q, people }: { t: TT; q: string; people: AdminPerson[] }) {
  return (
    <>
      <Title t={t} title="Find a person" sub="Look up by email, Plenary ID or ORCID. Paper contents and reviews are never shown here." />
      <form action="/admin" method="get" className="mt-5 flex max-w-[640px] gap-2.5">
        <input type="hidden" name="tab" value="people" />
        <label htmlFor="adm-q" className="sr-only">{t("Search people")}</label>
        <input id="adm-q" name="q" type="search" defaultValue={q} placeholder={t("Email, PL-0000-0000 or ORCID")} className={`${ui.input} min-w-0 flex-auto`} />
        <button type="submit" className={ui.primary}>{t("Find")}</button>
      </form>
      {q.trim().length >= 3 && people.length === 0 ? <p className="mt-4 text-[#4A5263]">{t("Nobody matches “{q}”. Use the full email, Plenary ID or ORCID.", { q })}</p> : null}
      <div className="mt-4 flex max-w-[860px] flex-col gap-4">
        {people.map((p) => {
          const primary = p.emails.find((e) => e.primary) ?? p.emails[0];
          const initials = p.display_name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
          return (
            <section key={p.person_id} className={ui.card}>
              <div className="flex items-center gap-3.5">
                <span className="flex size-11 items-center justify-center rounded-full bg-[#E6EDFC] font-semibold text-[#1F47A8]">{initials}</span>
                <div className="min-w-0">
                  <p className="m-0 text-[17px] font-semibold">{p.display_name || t("(no name)")}</p>
                  <p className="m-0 font-mono text-[13px] text-[#4A5263]">{[p.plenary_id, p.orcid ? `ORCID ${p.orcid}` : null, t("since {d}", { d: fmt(t, p.created_at, false) })].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <dl className="m-0 mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14px]">
                <dt className="text-[#4A5263]">{t("Emails")}</dt>
                <dd className="m-0">{p.emails.map((e) => `${e.email}${e.primary ? ` (${t("primary")})` : ""}${e.verified ? "" : ` (${t("not verified")})`}`).join(" · ") || "—"}</dd>
                <dt className="text-[#4A5263]">{t("Roles")}</dt>
                <dd className="m-0">{p.roles.length ? p.roles.map((r) => `${t(ROLE[r.role] ?? r.role)} · ${r.venue}`).join(" — ") : t("None")}</dd>
                <dt className="text-[#4A5263]">{t("Last sign-in")}</dt>
                <dd className="m-0">{p.last_sign_in ? `${fmt(t, p.last_sign_in.at)} · ${p.last_sign_in.method}${p.last_sign_in.place ? ` · ${p.last_sign_in.place}` : ""}` : p.has_login ? t("No sign-in recorded") : t("No login yet (added by a co-author)")}</dd>
                <dt className="text-[#4A5263]">{t("Status")}</dt>
                <dd className="m-0">{p.merged_into ? t("Merged into {id}", { id: p.merged_into }) : p.locked_at ? <span className="text-[#B3261E]">{t("Locked")} · {fmt(t, p.locked_at)} · {p.locked_reason}</span> : t("Active")}</dd>
              </dl>
              {p.recent_admin.length ? (
                <details className="mt-3 text-[13px]">
                  <summary className="cursor-pointer text-[#2F5FD0]">{t("Admin history ({n})", { n: p.recent_admin.length })}</summary>
                  <ul className="m-0 mt-2 list-none p-0">{p.recent_admin.map((a, i) => <li key={i} className="py-0.5">{fmt(t, a.at)} · {a.action}{a.reason ? ` — ${a.reason}` : ""}</li>)}</ul>
                </details>
              ) : null}
              <div className="mt-4 flex flex-wrap items-start gap-2">
                {p.has_login && primary && !primary.verified ? <PersonAction id={p.person_id} action="verification.resent" email={primary.email} label="Resend verification" /> : null}
                {p.has_login ? <PersonAction id={p.person_id} action="person.signed_out" label="Sign out everywhere" /> : null}
                <LockForm id={p.person_id} locked={!!p.locked_at} merged={!!p.merged_into} />
              </div>
              <p className="m-0 mt-3 text-[13px] text-[#4A5263]">{t("Locking needs a reason · the person sees it in their account · logged.")}</p>
            </section>
          );
        })}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- status */
export function StatusView({ t, windows, audit, emailOn, aiOn, now }: { t: TT; windows: MaintenanceWindow[]; audit: AuditRow[]; emailOn: boolean; aiOn: boolean; now: number }) {
  const svcs: [string, string, string][] = [
    ["Website & sign-in", "Working", "#18744F"],
    ["Uploads & PDF checks", "Working", "#18744F"],
    ["Email delivery", emailOn ? "Working" : "Not set up (RESEND_API_KEY)", emailOn ? "#18744F" : "#A8600F"],
    ["AI tools", aiOn ? "Working" : "Not set up (ANTHROPIC_API_KEY)", aiOn ? "#18744F" : "#A8600F"],
  ];
  return (
    <>
      <Title t={t} title="System status" sub="What the public status page shows, and planned maintenance." />
      <div className="mt-5 grid max-w-[860px] gap-3.5 sm:grid-cols-2">
        {svcs.map(([n, s, c]) => (
          <div key={n} className={`${ui.card} flex items-center justify-between gap-3 px-4! py-3.5!`}>
            <span className="font-semibold">{t(n)}</span>
            <span className="flex items-center gap-1.5 text-[13px]" style={{ color: c }}><span aria-hidden className="size-2 rounded-full" style={{ background: c }} />{t(s)}</span>
          </div>
        ))}
      </div>
      <section className={`${ui.card} mt-4 max-w-[860px]`}>
        <h2 className="m-0 text-[17px] font-semibold">{t("Planned maintenance")}</h2>
        {windows.length === 0 ? <p className="mt-2 text-[14px] text-[#4A5263]">{t("Nothing planned.")}</p> : (
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {windows.map((w) => (
              <li key={w.id} className="rounded-[6px] border border-[#EEF0EC] px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px]"><strong>{fmt(t, w.starts_at)}</strong> → {fmt(t, w.ends_at)}{w.message ? ` · ${w.message}` : ""}</span>
                  {Date.parse(w.starts_at) > now ? <CancelMaintenance id={w.id} /> : <span className="text-[13px] text-[#4A5263]">{Date.parse(w.ends_at) > now ? t("In progress") : t("Finished")}</span>}
                </div>
                {w.near_deadlines.length ? (
                  <p className="m-0 mt-2 rounded-[6px] bg-[#FBEFDD] px-2.5 py-1.5 text-[13px] text-[#7A4508]">
                    {t("{n} deadline(s) within 24 hours of this window. Deadlines are never moved automatically.", { n: w.near_deadlines.length })} {w.near_deadlines.map((d) => `${d.venue} · ${d.label} · ${fmt(t, d.at)}`).join(" — ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <h3 className="m-0 mt-5 text-[15px] font-semibold">{t("Schedule maintenance")}</h3>
        <div className="mt-2"><MaintenanceForm /></div>
      </section>
      <section className={`${ui.card} mt-4 max-w-[860px]`}>
        <h2 className="m-0 text-[17px] font-semibold">{t("Recent admin actions")}</h2>
        {audit.length === 0 ? <p className="mt-2 text-[14px] text-[#4A5263]">{t("None yet.")}</p> : (
          <ul className="m-0 mt-3 list-none p-0 text-[14px]">
            {audit.map((a, i) => (
              <li key={i} className="border-b border-[#EEF0EC] py-1.5 last:border-0">
                <span className="font-mono text-[12px] text-[#4A5263]">{fmt(t, a.at)}</span> · <strong>{a.action}</strong>{a.target ? ` · ${a.target}` : ""}{a.admin_name ? ` · ${t("by {name}", { name: a.admin_name })}` : ""}{a.reason ? ` — ${a.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
