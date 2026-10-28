"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import type { UserIdentity } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import { useT } from "@/lib/i18n/client";
import { sx } from "@/components/account/styles";
import { OrcidIcon } from "@/components/signin/other-ways";

type Pk = { id: string; friendly_name?: string | null; created_at: string; last_used_at?: string | null };

const small = "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#F7F8F6] disabled:opacity-60";
const row = "flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0EC] py-3";
const tag = "rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em]";

/**
 * Passkeys and ORCID on the profile page (the Sign-in & security page is switched off for now).
 * Each part shows only while its sign-in switch is on (Admin › Venues › Ways to sign in).
 */
export function SignInWays({ passkey, orcid, orcidStatus }: { passkey: boolean; orcid: boolean; orcidStatus?: string }) {
  const t = useT();
  const [keys, setKeys] = useState<Pk[] | null>(null);
  const [orcidId, setOrcidId] = useState<UserIdentity | null>(null);
  const [identities, setIdentities] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    orcidStatus === "failed" ? { ok: false, text: "ORCID wasn’t connected. Try again." } : null,
  );
  const fmt = new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", year: "numeric" });

  const load = useCallback(async () => {
    const sb = createClient();
    if (passkey) {
      const { data, error } = await sb.auth.passkey.list();
      setKeys(error ? [] : ((data ?? []) as Pk[]));
    }
    if (orcid) {
      const { data } = await sb.auth.getUserIdentities();
      const ids = data?.identities ?? [];
      setIdentities(ids.length);
      setOrcidId(ids.find((i) => i.provider === "custom:orcid") ?? null);
    }
  }, [passkey, orcid]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  if (!passkey && !orcid) return null;

  async function addKey() {
    setMsg(null); setBusy("add");
    const { error } = await createClient().auth.registerPasskey();
    setBusy(null);
    if (error) {
      const m = String(error.message ?? "");
      setMsg({ ok: false, text: /cancel|abort|NotAllowed/i.test(m) ? "No passkey was added." : /disabled|not enabled/i.test(m) ? "Passkeys aren’t available yet." : "The passkey couldn’t be added. Try again." });
      return;
    }
    setMsg({ ok: true, text: "Passkey added. Next time, choose “Use a passkey” on the sign-in page." });
    void load();
  }
  async function removeKey(id: string) {
    setBusy(id);
    const { error } = await createClient().auth.passkey.delete({ passkeyId: id });
    setBusy(null);
    setMsg(error ? { ok: false, text: "The passkey couldn’t be removed. Try again." } : { ok: true, text: "Passkey removed." });
    void load();
  }
  async function connectOrcid() {
    setMsg(null); setBusy("orcid");
    const q = new URLSearchParams({ via: "link", next: "/workspace/account/profile" });
    const { error } = await createClient().auth.linkIdentity({ provider: "custom:orcid", options: { redirectTo: `${window.location.origin}/auth/callback?${q}` } });
    if (error) { setBusy(null); setMsg({ ok: false, text: /manual linking/i.test(error.message) ? "Connecting ORCID isn’t available yet." : "ORCID couldn’t be connected. Try again." }); }
  }
  async function disconnectOrcid() {
    if (!orcidId) return;
    setBusy("orcid");
    const { error } = await createClient().auth.unlinkIdentity(orcidId);
    setBusy(null);
    setMsg(error ? { ok: false, text: "ORCID couldn’t be disconnected. Try again." } : { ok: true, text: "ORCID disconnected." });
    void load();
  }

  const orcidNumber = orcidId ? String((orcidId.identity_data as Record<string, unknown> | undefined)?.sub ?? orcidId.id ?? "").replace(/^https?:\/\/orcid\.org\//, "") : "";

  return (
    <section className={`${sx.card} mb-5`} aria-labelledby="ways-h">
      <h2 id="ways-h" className={sx.h2}>{t("Faster sign-in")}</h2>
      <p className={sx.sub}>{t("Sign in without typing a password.")}</p>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`m-0 mt-2 text-[13px] ${msg.ok ? "text-[#14603F]" : "text-[#B3261E]"}`}>{t(msg.text)}</p> : null}
      <div className="mt-3">
        {passkey ? (
          <div className={`${row} items-start`}>
            <span className="min-w-0 flex-auto">
              <strong className="flex items-center gap-2 text-[14px]"><Fingerprint size={16} strokeWidth={1.75} aria-hidden />{t("Passkeys")}</strong>
              <span className="block text-[13px] text-[#4A5263]">{t("Face, fingerprint or device PIN. Add one on each device you use.")}</span>
              {keys?.map((k) => (
                <span key={k.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span>{k.friendly_name || t("Passkey")} · {t("added {date}", { date: fmt.format(new Date(k.created_at)) })}{k.last_used_at ? ` · ${t("last used {date}", { date: fmt.format(new Date(k.last_used_at)) })}` : ""}</span>
                  <button type="button" onClick={() => removeKey(k.id)} disabled={!!busy} className={`${small} text-[#B3261E]!`}>{t("Remove")}</button>
                </span>
              ))}
            </span>
            <span className="flex items-center gap-2">
              <span className={`${tag} ${keys?.length ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#EEF0EC] text-[#4A5263]"}`}>{keys?.length ? t("ON") : t("OFF")}</span>
              <button type="button" onClick={addKey} disabled={!!busy || keys === null} className={small}>{busy === "add" ? t("Waiting…") : t("Add a passkey")}</button>
            </span>
          </div>
        ) : null}
        {orcid ? (
          <div className={row}>
            <span className="min-w-0">
              <strong className="flex items-center gap-2 text-[14px]"><OrcidIcon />ORCID</strong>
              <span className="block text-[13px] text-[#4A5263]">{orcidId ? t("Connected{id}", { id: orcidNumber ? ` · ${orcidNumber}` : "" }) : t("Connect your ORCID iD, then sign in with ORCID.")}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className={`${tag} ${orcidId ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#EEF0EC] text-[#4A5263]"}`}>{orcidId ? t("LINKED") : t("OFF")}</span>
              {orcidId
                ? <button type="button" onClick={disconnectOrcid} disabled={!!busy || identities < 2} title={identities < 2 ? t("Keep at least one other way to sign in.") : undefined} className={small}>{t("Disconnect")}</button>
                : <button type="button" onClick={connectOrcid} disabled={!!busy} className={small}>{busy === "orcid" ? t("Opening ORCID…") : t("Connect ORCID")}</button>}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
