"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { sx } from "@/components/account/styles";
import { saveLoginAlias, type AliasState } from "@/lib/account/alias-actions";

const small = "inline-flex h-[42px] items-center whitespace-nowrap rounded-[4px] border-0 bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white disabled:opacity-60";

/** Profile: the login alias, a third way to type who you are on the sign-in page (besides email and PIN). */
export function AliasCard({ alias }: { alias: string | null }) {
  const t = useT();
  const [s, act, pending] = useActionState<AliasState, FormData>(saveLoginAlias, {});
  const [v, setV] = useState(alias ?? "");
  const saved = s.ok ? s.alias ?? null : alias;
  return (
    <section className={`${sx.card} mb-5`} aria-labelledby="alias-h">
      <h2 id="alias-h" className={sx.h2}>{t("Login alias")}</h2>
      <p className={sx.sub}>{t("A short name you can type on the sign-in page instead of your email or PIN. Only you see it.")}</p>
      <form action={act} className="mt-3 flex flex-wrap items-end gap-2">
        <label className={`${sx.label} min-w-0 flex-auto`} htmlFor="alias-in">{t("Alias")}
          <input id="alias-in" name="alias" value={v} onChange={(e) => setV(e.target.value.toLowerCase())} maxLength={32}
            autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="jdoe" className={`${sx.input} font-mono`} aria-describedby="alias-help" />
        </label>
        <button type="submit" disabled={pending || v.trim() === (saved ?? "")} className={small}>{pending ? t("Saving…") : v.trim() ? t("Save") : t("Remove")}</button>
      </form>
      <p id="alias-help" className={`${sx.help} mt-1.5 mb-0`}>{t("3–32 characters: letters, digits, dots, dashes or underscores, starting with a letter.")}</p>
      {s.error ? <p role="alert" className="m-0 mt-2 text-[13px] text-[#B3261E]">{t(s.error)}</p> : null}
      {s.info ? <p role="status" className="m-0 mt-2 text-[13px] text-[#14603F]">{t(s.info)}</p> : null}
    </section>
  );
}
