import Link from "@/components/site/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getT } from "@/lib/i18n/server";
import { getMe } from "@/lib/auth/me";
import { createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/tokens";
import { MERGE_COOKIE } from "@/lib/account-help/constants";
import { cancelMerge, confirmMerge, signOutForMerge, startMerge } from "@/lib/account-help/actions";
import { Reveal } from "@/components/motion/reveal";
import { AccountHelpSkeleton } from "@/components/skeletons/admin";
import { HelpBody, HelpPage, helpCard, helpKicker } from "@/components/account-help/frame";
import { ui } from "@/components/manage/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Merge two accounts") };
}

type SP = { done?: string; p?: string; r?: string; e?: string };
type Status = { state: "none" | "done" | "expired" | "signed_out" | "keeper" | "second"; keeper?: { name: string; plenary_id: string | null; email: string | null } };
type Preview = { papers: number; reviews: number; roles: number; threads: number; follows: number; emails: string[]; shared_venues: string[]; me: { name: string; plenary_id: string | null } };

function Person({ kicker, name, line, active }: { kicker: string; name: string; line: string; active?: boolean }) {
  return (
    <div className={`rounded-[6px] border p-3.5 ${active ? "border-[#2F5FD0] bg-[#FBFCFF]" : "border-[#DADDE3]"}`}>
      <p className={helpKicker}>{kicker}</p>
      <p className="m-0 mt-1.5 font-semibold">{name}</p>
      <p className="m-0 font-mono text-[13px] text-[#4A5263]">{line}</p>
    </div>
  );
}

async function Inner({ searchParams }: { searchParams: Promise<SP> }) {
  const [sp, t, me, jar] = await Promise.all([searchParams, getT(), getMe(), cookies()]);
  const token = jar.get(MERGE_COOKIE)?.value;
  const supabase = await createClient();
  let status: Status = { state: "none" };
  if (token && me) {
    const { data } = await supabase.rpc("merge_status", { p_token_hash: hashToken(token) });
    if (data) status = data as Status;
  } else if (token) status = { state: "signed_out" };
  let preview: Preview | null = null;
  if (status.state === "second") {
    const { data } = await supabase.rpc("merge_preview", { p_token_hash: hashToken(token!) });
    preview = (data as Preview) ?? null;
  }
  const errors: Record<string, string> = {
    start: "We couldn’t start the merge. Please try again.",
    expired: "The merge link expired (30 minutes). Start again from the account you want to keep.",
    merge: "The merge didn’t go through. Nothing was changed. Please try again or contact support.",
  };
  const meLine = me ? [me.person?.plenary_id, me.email].filter(Boolean).join(" · ") : "";

  let body;
  if (sp.done) {
    body = (
      <section className={helpCard}>
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full bg-[#E1F3EA] font-bold text-[#14603F]">✓</span>
          <div>
            <h2 className="m-0 font-serif text-[28px] font-normal">{t("Accounts merged")}</h2>
            <p role="status" className="mt-1 text-[#4A5263]">{t("{p} paper(s) and {r} review(s) moved. Sign in with the email of the account you kept; the other email stays on your profile so co-authors still find you.", { p: Number(sp.p ?? 0), r: Number(sp.r ?? 0) })}</p>
            <Link href="/sign-in?next=/workspace" className={`${ui.primary} mt-4`}>{t("Sign in")}</Link>
          </div>
        </div>
      </section>
    );
  } else if (status.state === "second" && preview && status.keeper) {
    body = (
      <section className={helpCard}>
        <h2 className="m-0 text-[17px] font-semibold">{t("Merge this account into the one you keep?")}</h2>
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <Person kicker={t("Keep this one")} name={status.keeper.name} line={[status.keeper.plenary_id, status.keeper.email].filter(Boolean).join(" · ")} active />
          <Person kicker={t("Merge in (you are signed in to it)")} name={preview.me.name || me?.email || ""} line={meLine} />
        </div>
        <div className="mt-4 border-t border-[#EEF0EC] pt-3.5">
          <p className="m-0 mb-2 text-[13px] font-semibold">{t("What moves")}</p>
          <ul className="m-0 pl-[18px] text-[14px] leading-[1.8]">
            <li>{t("{n} paper(s) — you stay an author", { n: preview.papers })}</li>
            <li>{t("{n} review(s), with their credit", { n: preview.reviews })}</li>
            <li>{t("{n} role(s), {m} inbox thread(s) and {f} followed venue(s)", { n: preview.roles, m: preview.threads, f: preview.follows })}</li>
            <li>{t("The email(s) {e} become extra emails on the kept account", { e: preview.emails.join(", ") || "—" })}</li>
          </ul>
          {preview.shared_venues.length ? <p className={`${ui.warn} mt-2.5`}>{t("Both accounts hold roles in {v}. The chairs are told so conflicts stay correct.", { v: preview.shared_venues.join(", ") })}</p> : null}
          <p className="mt-2.5 text-[13px] text-[#4A5263]">{t("This can’t be undone. This login stops working afterwards.")}</p>
          <div className="mt-3.5 flex flex-wrap gap-3">
            <form action={confirmMerge}><button type="submit" className={ui.primary}>{t("Merge accounts")}</button></form>
            <form action={cancelMerge}><button type="submit" className={ui.ghost}>{t("Cancel")}</button></form>
          </div>
        </div>
      </section>
    );
  } else if (status.state === "keeper" || status.state === "signed_out") {
    body = (
      <section className={helpCard}>
        <h2 className="m-0 text-[17px] font-semibold">{t("Now sign in to the other account")}</h2>
        <p className="mt-1.5 text-[14px] text-[#4A5263]">{t("Prove you own the second account by signing in to it once. You have 30 minutes, on this browser.")}</p>
        {status.keeper ? <div className="mt-4 max-w-[420px]"><Person kicker={t("Keep this one")} name={status.keeper.name} line={[status.keeper.plenary_id, status.keeper.email].filter(Boolean).join(" · ")} active /></div> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {status.state === "keeper"
            ? <form action={signOutForMerge}><button type="submit" className={ui.primary}>{t("Sign out and sign in to the other account")}</button></form>
            : <Link href="/sign-in?next=/account-help/merge" className={ui.primary}>{t("Sign in to the other account")}</Link>}
          <form action={cancelMerge}><button type="submit" className={ui.ghost}>{t("Cancel merge")}</button></form>
        </div>
      </section>
    );
  } else {
    body = (
      <section className={helpCard}>
        <h2 className="m-0 text-[17px] font-semibold">{t("Merge two accounts")}</h2>
        <p className="mt-1.5 text-[14px] text-[#4A5263]">{t("You signed up twice — for example once with a personal and once with a work email. Everything moves into the account you keep.")}</p>
        {sp.e && errors[sp.e] ? <p role="alert" className={`${ui.bad} mt-3`}>{t(errors[sp.e])}</p> : null}
        {status.state === "expired" || status.state === "done" ? <p className={`${ui.warn} mt-3`}>{t(errors.expired)}</p> : null}
        {me ? (
          <>
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <Person kicker={t("Keep this one")} name={me.person?.display_name || me.email} line={meLine} active />
              <div className="rounded-[6px] border border-dashed border-[#B7BDC9] p-3.5">
                <p className={helpKicker}>{t("Merge in")}</p>
                <p className="m-0 mt-1.5 text-[13px] text-[#4A5263]">{t("Next you sign out and sign in to the other account once, to prove you own it.")}</p>
              </div>
            </div>
            <ol className="m-0 mt-4 pl-[18px] text-[14px] leading-[1.8]">
              <li>{t("Start here, signed in to the account you want to KEEP.")}</li>
              <li>{t("Sign in to the other account when asked.")}</li>
              <li>{t("Check what moves and confirm.")}</li>
            </ol>
            <form action={startMerge} className="mt-4"><button type="submit" className={ui.primary}>{t("Start merge")}</button></form>
          </>
        ) : (
          <div className="mt-4">
            <p className="text-[14px]">{t("First sign in to the account you want to keep.")}</p>
            <Link href="/sign-in?next=/account-help/merge" className={`${ui.primary} mt-3`}>{t("Sign in")}</Link>
          </div>
        )}
      </section>
    );
  }
  return <HelpBody t={t} tab="merge">{body}</HelpBody>;
}

/** AH02 — merge two accounts: start signed in to the kept account, prove the second by signing in to it, confirm. */
export default function Page(props: { searchParams: Promise<SP> }) {
  return <HelpPage><Reveal fallback={<AccountHelpSkeleton />}><Inner {...props} /></Reveal></HelpPage>;
}
