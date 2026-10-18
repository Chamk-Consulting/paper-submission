"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { respondCommitteeInvitation } from "@/lib/manage/setup2-actions";

/** Accept / decline buttons of a committee invitation (A3: the role starts on acceptance). */
export function InviteRespond({ token, slug }: { token: string; slug: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const go = (accept: boolean) =>
    start(async () => {
      setErr(null);
      const r = await respondCommitteeInvitation(token, accept);
      if (r.error) setErr(r.error);
      else setDone(accept ? "accepted" : "declined");
    });
  if (done === "accepted")
    return (
      <div role="status" className="mt-6">
        <p className={ui.ok}>{t("You've joined the committee. Your new role is active now.")}</p>
        <Link href={`/manage/${slug}`} className={`${ui.navy} mt-4 inline-flex`}>{t("Open the event")}</Link>
      </div>
    );
  if (done === "declined") return <p role="status" className={`${ui.hint} mt-6`}>{t("You declined. The organizers have been told.")}</p>;
  return (
    <div className="mt-6">
      {err ? <p role="alert" className={`${ui.bad} mb-3`}>{t(err)}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={pending} onClick={() => go(true)} className={ui.primary}>{t("Accept role")}</button>
        <button type="button" disabled={pending} onClick={() => go(false)} className={ui.ghost}>{t("Decline")}</button>
      </div>
    </div>
  );
}
