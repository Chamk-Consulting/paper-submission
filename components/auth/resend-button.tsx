"use client";

import { useEffect, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import type { ResendState } from "@/lib/auth/resend-actions";

/** "Resend" with a countdown that doubles after each try (60s, 120s, 240s…), capped at 5 resends (PR04). */
export function ResendButton({ send, label, start = 60, className = "" }: { send: () => Promise<ResendState>; label: string; start?: number; className?: string }) {
  const t = useT();
  const [left, setLeft] = useState(start);
  const [tries, setTries] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  const limit = tries >= 5;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const click = () =>
    startTransition(async () => {
      const r = await send();
      if (r.ok) {
        setTries((n) => n + 1);
        setLeft(start * 2 ** Math.min(tries + 1, 3));
        setMsg({ ok: true, text: t("Sent. Use the newest email — older links and codes stop working.") });
      } else {
        setLeft(start);
        setMsg({ ok: false, text: t(r.message ?? "Something went wrong. Please try again.") });
      }
    });
  return (
    <span className={`flex flex-col gap-1 ${className}`}>
      {limit ? (
        <span className="text-[13px] text-[#7A4508]">{t("Resend limit reached. Check spam, or contact support.")}</span>
      ) : left > 0 ? (
        <span className="font-mono text-[13px] text-[#4A5263]" aria-live="off">{t("Resend in {time}", { time: fmt(left) })}</span>
      ) : (
        <button type="button" onClick={click} disabled={pending} className="min-h-6 self-start border-0 bg-transparent p-0 text-[14px] font-semibold text-[#2F5FD0] underline hover:text-[#1F47A8] disabled:opacity-60">
          {pending ? t("Sending…") : label}
        </button>
      )}
      {msg ? <span role={msg.ok ? "status" : "alert"} className={`text-[13px] ${msg.ok ? "text-[#14603F]" : "text-[#B3261E]"}`}>{msg.text}</span> : null}
    </span>
  );
}
