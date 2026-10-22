import type { T } from "@/lib/i18n/translate";
import type { FunnelRow } from "@/lib/admin/data";

const STEPS: [string, string][] = [
  ["started", "Started sign-up"],
  ["code_sent", "Code emailed"],
  ["confirmed", "Email confirmed (new)"],
  ["returning", "Existing account, signed in"],
  ["password", "Password chosen"],
  ["profile", "Profile finished"],
];

/** Plan E1: where people stop during sign-up (last 30 days, counts only — no personal data). */
export function SignupFunnel({ t, rows }: { t: T; rows: FunnelRow[] }) {
  const n = Object.fromEntries(rows.map((r) => [r.step, Number(r.n)]));
  const top = Math.max(1, n.started ?? 0, n.code_sent ?? 0);
  return (
    <section id="signups" className="mt-6 scroll-mt-24 rounded-[8px] border border-[#DADDE3] bg-white px-5 py-4">
      <h2 className="m-0 text-[16px] font-semibold">{t("Sign-up funnel · last 30 days")}</h2>
      {rows.length === 0 ? <p className="mb-0 mt-2 text-[14px] text-[#4A5263]">{t("No sign-ups recorded yet (or the database update is pending).")}</p> : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0 text-[14px]">
          {STEPS.map(([k, label]) => {
            const v = n[k] ?? 0;
            return (
              <li key={k} className="grid grid-cols-[180px_1fr_48px] items-center gap-3">
                <span>{t(label)}</span>
                <span className="h-2.5 rounded-sm bg-[#EEF0EC]"><span className="block h-full rounded-sm bg-[#2F5FD0]" style={{ width: `${Math.round((v / top) * 100)}%` }} /></span>
                <span className="text-right font-mono">{v}</span>
              </li>
            );
          })}
        </ul>
      )}
      {(n.email_failed ?? 0) + (n.code_failed ?? 0) > 0 ? (
        <p className="mb-0 mt-3 text-[13px] text-[#7A4508]">{t("Problems: {a} emails not sent · {b} wrong or expired codes.", { a: n.email_failed ?? 0, b: n.code_failed ?? 0 })}</p>
      ) : null}
    </section>
  );
}
