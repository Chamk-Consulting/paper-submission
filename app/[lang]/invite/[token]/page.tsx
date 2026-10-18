import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getT } from "@/lib/i18n/server";
import { INTL } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/auth/me";
import { hashToken } from "@/lib/tokens";
import { ROLE_LABEL } from "@/lib/manage/data";
import { ui } from "@/components/manage/ui";
import { InviteRespond } from "@/components/manage/setup2/invite-respond";
import { Reveal } from "@/components/motion/reveal";
import { InviteSkeleton } from "@/components/skeletons/setup2";

const nowMs = () => Date.now();

type P = { params: Promise<{ token: string }> };
type Inv = { id: string; venue_id: string; venue_name: string; venue_slug: string; role: string; status: string; expires_at: string; inviter: string | null; email: string | null };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Committee invitation"), robots: { index: false } };
}

async function Inner({ params }: P) {
  const { token } = await params;
  const t = await getT();
  const locale = await getLocale();
  const ok = /^[A-Za-z0-9_-]{16,128}$/.test(token);
  const supabase = await createClient();
  const [{ data }, me] = await Promise.all([
    ok ? supabase.rpc("invitation_by_token", { p_token_hash: hashToken(token) }) : Promise.resolve({ data: null }),
    getMe(),
  ]);
  const inv = (Array.isArray(data) ? data[0] : data) as Inv | null | undefined;
  const status = !inv ? "missing" : inv.status === "pending" && Date.parse(inv.expires_at) < nowMs() ? "expired" : inv.status;
  const roleLabel = inv ? t((ROLE_LABEL as Record<string, string>)[inv.role] ?? inv.role) : "";
  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <main id="main" className="mx-auto max-w-[560px] px-4 py-16">
      <section className={`${ui.card} p-8!`}>
        <p className={ui.kicker}>{t("Committee invitation")}</p>
        {!inv || status === "missing" ? (
          <>
            <h1 className="mt-2 font-serif text-[30px] font-normal leading-tight text-[#0E1B3D]">{t("This invitation link doesn't work")}</h1>
            <p className="mt-3 text-[#4A5263]">{t("Check that you used the whole link from the email, or ask the organizer to send a new one.")}</p>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-serif text-[30px] font-normal leading-tight text-[#0E1B3D]">
              {t("{venue}: {role}", { venue: inv.venue_name, role: roleLabel })}
            </h1>
            <p className="mt-3 text-[#4A5263]">
              {inv.inviter ? t("{name} invited you to join the committee as {role}.", { name: inv.inviter, role: roleLabel }) : t("You're invited to join the committee as {role}.", { role: roleLabel })}
            </p>
            {inv.email ? <p className={`${ui.hint} mt-1`}>{t("Sent to {email}", { email: inv.email })}</p> : null}
            {status === "pending" ? (
              <>
                <p className={`${ui.hint} mt-1`}>{t("Valid until {date}", { date: new Date(inv.expires_at).toLocaleDateString(INTL[locale], { day: "numeric", month: "long", year: "numeric" }) })}</p>
                {me ? <InviteRespond token={token} slug={inv.venue_slug} /> : (
                  <div className="mt-6">
                    <p className="text-[#4A5263]">{t("Sign in or create your Plenary account to answer. Your role starts when you accept (A3).")}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href={`/sign-in?next=${next}`} className={ui.navy}>{t("Sign in")}</Link>
                      <Link href={`/sign-in?tab=create&next=${next}`} className={ui.ghost}>{t("Create account")}</Link>
                    </div>
                  </div>
                )}
              </>
            ) : status === "accepted" ? (
              <div className="mt-6">
                <p className={ui.ok}>{t("This invitation was already accepted.")}</p>
                <Link href={`/manage/${inv.venue_slug}`} className={`${ui.navy} mt-4 inline-flex`}>{t("Open the event")}</Link>
              </div>
            ) : (
              <p className={`${ui.warn} mt-6`}>
                {status === "expired" ? t("This invitation has expired. Ask the organizer to send a new one.")
                  : status === "revoked" ? t("The organizer withdrew this invitation.")
                    : t("This invitation was declined.")}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<InviteSkeleton />}><Inner {...props} /></Reveal>;
}
