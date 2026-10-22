"use client";

import { Check, Circle, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { scorePassword } from "@/lib/auth/password-rules";

/* One strength bar + rule checklist for every password form (sign-up, reset, Security page), so the rules read
   the same everywhere and match the server (lib/auth/password-rules.ts + lib/auth/pwned.ts). */

const COLORS = ["#DADDE3", "#B3261E", "#A8600F", "#2F5FD0", "#14603F"];
const LABELS = ["—", "Too weak", "Could be stronger", "Good", "Strong"];

export type LeakState = "idle" | "checking" | "clean" | "leaked" | "unknown";

/** Looks the password up in known leaks once it meets the other rules (k-anonymity: only 5 hash characters leave the browser). */
export function useLeakCheck(pw: string, eligible: boolean): LeakState {
  const [res, setRes] = useState<{ pw: string; state: LeakState } | null>(null);
  useEffect(() => {
    if (!eligible) return;
    let gone = false;
    const timer = setTimeout(async () => {
      try {
        const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(pw));
        const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        const r = await fetch(`/api/password-check?p=${hex.slice(0, 5)}`);
        const body = r.ok ? await r.text() : "";
        const leaked = body.split("\n").some((l) => { const [s, n] = l.trim().split(":"); return s === hex.slice(5) && Number(n) > 0; });
        if (!gone) setRes({ pw, state: !body ? "unknown" : leaked ? "leaked" : "clean" });
      } catch {
        if (!gone) setRes({ pw, state: "unknown" });
      }
    }, 450);
    return () => { gone = true; clearTimeout(timer); };
  }, [pw, eligible]);
  if (!eligible) return "idle";
  return res?.pw === pw ? res.state : "checking";
}

type Mark = "ok" | "bad" | "todo" | "wait";

/**
 * Strength bar and checklist under a new-password field. `current` (Security page) adds "Different from your
 * current password"; `flag` turns unmet rules red after a submit attempt. `leak` comes from useLeakCheck.
 */
export function PasswordMeter({ pw, email, current, flag, leak, id }: { pw: string; email: string; current?: string; flag: boolean; leak: LeakState; id: string }) {
  const t = useT();
  const r = scorePassword(pw, email, current);
  const same = current !== undefined && !!current && !!pw && !r.different;
  const sc = leak === "leaked" || same ? Math.min(r.sc, 1) : r.sc;
  // Rules met by typing more (length, mix) stay grey until a submit; rules a password breaks for good (common,
  // leaked, has your email, same as now) turn red at once.
  const m = (pass: boolean): Mark => (pass ? "ok" : flag ? "bad" : "todo");
  const hard = (pass: boolean): Mark => (pass ? "ok" : pw ? "bad" : "todo");
  const rules: [Mark, string, string?][] = [
    [m(r.long), "At least 12 characters"],
    [m(r.mixed), "Mix of letters, numbers and symbols", r.mixed ? undefined : "At least 3 of: lowercase, uppercase, number, symbol — or 16+ characters"],
    [!r.notCommon ? hard(false) : leak === "leaked" ? "bad" : leak === "checking" ? "wait" : leak === "clean" || leak === "unknown" ? "ok" : m(false), "Not a common or leaked password",
      leak === "leaked" ? "Found in a known data leak — choose another" : leak === "unknown" ? "Couldn’t check leaks right now; we check again when you save" : undefined],
    [hard(r.notEmail), "Doesn’t contain your name or email"],
    ...(current !== undefined ? [[same ? "bad" : m(!!current && !!pw && r.different), "Different from your current password", current ? undefined : "Type your current password first"] as [Mark, string, string?]] : []),
  ];
  const kinds: [boolean, string][] = [[r.kinds.lower, "abc"], [r.kinds.upper, "ABC"], [r.kinds.number, "123"], [r.kinds.symbol, "#$&"]];
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <div aria-hidden className="grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 rounded-full transition-colors" style={{ background: sc >= i ? COLORS[sc] : "#E4E6EA" }} />)}
      </div>
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="flex gap-1" aria-hidden>
          {kinds.map(([on, label]) => (
            <span key={label} className={`rounded-[4px] px-1.5 py-px font-mono text-[11px] ${on ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#F2F3F0] text-[#6B7385]"}`}>{label}</span>
          ))}
        </span>
        <span aria-live="polite" className="font-semibold" style={{ color: pw ? COLORS[sc] : "#4A5263" }}>{pw ? t(LABELS[sc]) : t("Strength")}</span>
      </div>
      <ul id={id} className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0 text-[13px]">
        {rules.map(([mark, label, hint]) => (
          <li key={label} className="flex items-start gap-2" style={{ color: mark === "ok" ? "#14603F" : mark === "bad" ? "#B3261E" : "#4A5263" }}>
            <span aria-hidden className={`mt-px flex size-4 flex-none items-center justify-center rounded-full ${mark === "ok" ? "bg-[#E1F3EA]" : mark === "bad" ? "bg-[#FDECEA]" : ""}`}>
              {mark === "ok" ? <Check size={11} strokeWidth={3} /> : mark === "bad" ? <X size={11} strokeWidth={3} /> : mark === "wait" ? <LoaderCircle size={13} className="animate-spin" /> : <Circle size={9} strokeWidth={2} />}
            </span>
            <span>
              <span className="sr-only">{mark === "ok" ? t("Met:") : mark === "bad" ? t("Not met:") : mark === "wait" ? t("Checking:") : t("To do:")} </span>
              {t(label)}
              {hint ? <span className="block text-[12px] text-[#4A5263]">{t(hint)}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
