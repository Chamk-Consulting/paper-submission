"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { scanBadge, type ScanResult } from "@/lib/attend/actions";
import { fmtMoney } from "@/lib/attend/money";

/* BD01 check-in desk: camera QR scanning (BarcodeDetector where the browser has it), a USB scanner or typed code as
   fallback, and the result card: ok / already checked in / unpaid / not registered. */

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

const noop = () => () => {};

const STYLE: Record<string, [string, string, string]> = {
  ok: ["#E1F3EA", "#B9E0CB", "#14603F"],
  already: ["#FBEFDD", "#F1D3A6", "#7A4508"],
  unpaid: ["#FBEFDD", "#F1D3A6", "#7A4508"],
  not_found: ["#FDECEA", "#F3C3BE", "#B3261E"],
  invalid: ["#FDECEA", "#F3C3BE", "#B3261E"],
  error: ["#FDECEA", "#F3C3BE", "#B3261E"],
};

export function DeskScanner({ slug, tz, initialChecked, registered }: { slug: string; tz: string; initialChecked: number; registered: number }) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const last = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const supported = useSyncExternalStore(noop, () => "BarcodeDetector" in window, () => null);
  const [camera, setCamera] = useState<"off" | "on" | "denied">("off");
  const [res, setRes] = useState<(ScanResult & { raw: string }) | null>(null);
  const [checked, setChecked] = useState(initialChecked);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();

  const run = useCallback((raw: string, force = false) => {
    const now = Date.now();
    if (!force && raw === last.current.code && now - last.current.at < 4000) return; // the same badge held in front of the camera
    last.current = { code: raw, at: now };
    start(async () => {
      const r = await scanBadge(slug, raw, force);
      setRes({ ...r, raw });
      if (r.result === "ok") setChecked((n) => n + 1);
    });
  }, [slug]);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((x) => x.stop());
    stream.current = null;
    setCamera("off");
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (camera !== "on" || !supported) return;
    const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
    const det = new Ctor({ formats: ["qr_code"] });
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      const v = video.current;
      if (v && v.readyState >= 2) {
        try { const found = await det.detect(v); if (found[0]?.rawValue) run(found[0].rawValue); } catch { /* frame not ready */ }
      }
      setTimeout(tick, 300);
    };
    tick();
    return () => { alive = false; };
  }, [camera, supported, run]);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = s;
      if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
      setCamera("on");
    } catch { setCamera("denied"); }
  }

  const [bg, bd, ink] = res ? STYLE[res.result] ?? STYLE.error : STYLE.ok;
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(t.intl, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }) : "");
  const talk = res?.talk ? t("presents {paper} {when} in {room}", { paper: res.talk.number ? `#${String(res.talk.number).padStart(4, "0")}` : res.talk.code, when: when(res.talk.starts_at), room: res.talk.room ?? res.talk.code }) : "";
  const title = !res ? "" : res.result === "ok" ? `✓ ${t("Welcome, {name}", { name: res.full_name ?? res.number ?? "" })}`
    : res.result === "already" ? t("Already checked in") : res.result === "unpaid" ? t("Not paid yet") : res.result === "not_found" ? t("No registration found")
    : res.result === "invalid" ? t("That isn't a Plenary badge code") : t("Something went wrong. Please try again.");
  const text = !res ? "" : res.result === "ok" ? [t(res.reg_type ?? ""), res.number, talk].filter(Boolean).join(" · ") + "."
    : res.result === "already" ? t("This badge was scanned at {time}. Check it is the same person.", { time: when(res.at) })
    : res.result === "unpaid" ? t("{name} · {n} · {amount} still due. Take payment or check in anyway.", { name: res.full_name ?? "", n: res.number ?? "", amount: res.currency ? fmtMoney(res.amount_cents, res.currency, t.intl) : "—" })
    : res.result === "not_found" ? t("Send them to the registration desk, or search by name below. A reissued badge makes the old one stop working.")
    : res.result === "invalid" ? t("Scan the QR on a Plenary badge, or search by name.") : "";

  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white px-6 py-5">
      <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Check-in desk · scan")}</p>
      <div className="relative mt-3 flex h-[220px] items-center justify-center overflow-hidden rounded-[8px] bg-[#121826]">
        <video ref={video} muted playsInline className={`absolute inset-0 size-full object-cover ${camera === "on" ? "" : "hidden"}`} />
        <div aria-hidden className="relative size-[130px] rounded-[12px] border-[3px] border-[#F2A93B]" />
        <span className="absolute inset-x-0 bottom-2.5 text-center text-[12px] text-[#B9C3DA]">
          {camera === "on" ? t("Point the camera at a badge") : camera === "denied" ? t("Camera blocked — allow it in the browser, or use a scanner") : supported === false ? t("This browser can't read QR codes from the camera") : t("Camera is off")}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {supported ? (camera === "on"
          ? <button type="button" onClick={stop} className="inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D]">{t("Stop camera")}</button>
          : <button type="button" onClick={startCamera} className="inline-flex h-9 items-center rounded-[4px] border-0 bg-[#F2A93B] px-3.5 text-[13px] font-semibold text-[#0E1B3D] hover:bg-[#E89B26]">{t("Start camera")}</button>) : null}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) { run(code.trim(), false); setCode(""); } }}>
        <label htmlFor="badge-code" className="sr-only">{t("Badge code")}</label>
        <input id="badge-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder={t("USB scanner or type the badge code")}
          className="box-border h-10 min-w-0 flex-auto rounded-[4px] border border-[#B7BDC9] px-3 font-mono text-[14px]" />
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D] disabled:opacity-60">{t("Check")}</button>
      </form>

      <div aria-live="polite">
        {pending ? <p className="mb-0 mt-3.5 text-[14px] text-[#4A5263]">{t("Checking…")}</p> : res ? (
          <div role="status" className="mt-3.5 rounded-[8px] border px-4 py-3.5" style={{ background: bg, borderColor: bd }}>
            <p className="m-0 text-[18px] font-bold" style={{ color: ink }}>{title}</p>
            {text ? <p className="mb-0 mt-1 text-[14px] text-[#121826]">{text}</p> : null}
            {res.result === "unpaid" ? (
              <button type="button" onClick={() => run(res.raw, true)} className="mt-2.5 inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D]">{t("Check in anyway")}</button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-[6px] border border-[#EEF0EC] p-2.5"><p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Checked in")}</p><p className="mb-0 mt-1 font-mono text-[22px] font-semibold">{checked}</p></div>
        <div className="rounded-[6px] border border-[#EEF0EC] p-2.5"><p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Registered")}</p><p className="mb-0 mt-1 font-mono text-[22px] font-semibold">{registered}</p></div>
      </div>
    </section>
  );
}
