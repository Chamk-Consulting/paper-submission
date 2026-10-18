"use client";

import Link from "next/link";
import { useState } from "react";

export function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy Plenary ID"
      onClick={async () => {
        try { await navigator.clipboard.writeText(id); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
      }}
      className="h-[26px] rounded-[3px] border border-[#DADDE3] bg-[#F5F6F3] px-[9px] text-[12px] font-semibold text-[#121826]"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** PR09 passkey offer. Passkeys aren't available yet, so "Add a passkey" explains that instead of pretending. */
export function PasskeyOffer({ nextHref, nextLabel }: { nextHref: string; nextLabel: string }) {
  const [step, setStep] = useState<"offer" | "soon" | "plain">("offer");
  if (step === "offer" || step === "soon")
    return (
      <section aria-labelledby="pk-h" className="mt-4 rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4">
        <h2 id="pk-h" className="m-0 text-[16px] font-semibold">Sign in faster next time?</h2>
        <p className="mt-0.5 text-[14px] text-[#4A5263]">Add a passkey: one tap with your face or fingerprint. Your email code stays as a backup.</p>
        {step === "soon" ? <p role="status" className="mt-2 text-[13px] text-[#7A4508]">Passkeys are coming soon — we&apos;ll offer this again when they&apos;re ready. Email codes keep working.</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {/* TODO(auth): WebAuthn passkey enrolment once supported. */}
          <button type="button" onClick={() => setStep("soon")} className="h-11 flex-[1_1_160px] rounded-[4px] border-0 bg-[#F2A93B] text-[15px] font-semibold text-[#0E1B3D]">Add a passkey</button>
          <button type="button" onClick={() => setStep("plain")} className="h-11 rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[15px] font-medium text-[#121826]">Not now</button>
        </div>
        <label className="mt-2.5 flex min-h-6 items-center gap-2 text-[13px] text-[#4A5263]">
          <input type="checkbox" className="size-4 accent-[#0E1B3D]" onChange={(e) => { try { localStorage.setItem("plenary.passkeyOffer", e.target.checked ? "never" : ""); } catch { /* storage blocked */ } }} />
          Don&apos;t ask again on this device
        </label>
      </section>
    );
  return (
    <div className="mt-4">
      <div className="flex justify-between gap-3 text-[13px] text-[#4A5263]">
        <span role="status">{nextLabel}</span>
        <Link href={nextHref} className="font-semibold text-[#2F5FD0]">Go now →</Link>
      </div>
      <p className="mt-3 text-[13px] text-[#4A5263]">You can add a passkey later in Settings › Security.</p>
    </div>
  );
}
