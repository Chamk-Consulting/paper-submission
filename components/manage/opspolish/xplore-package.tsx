"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { makeZip, type ZipEntry } from "@/lib/zip";
import { ui } from "@/components/manage/ui";

type Manifest = { name: string; papers: number; missing: string[]; texts: { name: string; text: string }[]; files: { name: string; url: string }[] };

/** EM32 — build the IEEE Xplore upload package (metadata + final PDFs) in the browser and save it as one ZIP. */
export function XplorePackage({ slug }: { slug: string }) {
  const t = useT();
  const [state, setState] = useState<{ phase: "idle" | "busy" | "done" | "error"; got: number; total: number; missing: string[]; msg?: string }>({ phase: "idle", got: 0, total: 0, missing: [] });

  async function build() {
    setState({ phase: "busy", got: 0, total: 0, missing: [] });
    try {
      const res = await fetch(`/api/manage/${slug}/proceedings/package`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 403 ? "You don't have access to the proceedings." : "Couldn't prepare the package.");
      const m = (await res.json()) as Manifest;
      const enc = new TextEncoder();
      const entries: ZipEntry[] = m.texts.map((x) => ({ name: x.name, data: enc.encode(x.text) }));
      const missing = [...m.missing];
      setState((s) => ({ ...s, total: m.files.length }));
      let got = 0;
      let i = 0;
      const worker = async () => {
        while (i < m.files.length) {
          const f = m.files[i++];
          try {
            const r = await fetch(f.url);
            if (!r.ok) throw new Error();
            entries.push({ name: f.name, data: new Uint8Array(await r.arrayBuffer()) });
          } catch {
            missing.push(f.name);
          }
          got++;
          setState((s) => ({ ...s, got }));
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      entries.sort((a, b) => a.name.localeCompare(b.name));
      const blob = makeZip(entries);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = m.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      setState({ phase: "done", got, total: m.files.length, missing });
    } catch (e) {
      setState({ phase: "error", got: 0, total: 0, missing: [], msg: e instanceof Error ? e.message : "Couldn't prepare the package." });
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={build} disabled={state.phase === "busy"} className={`${ui.navy} h-9! px-3! text-[14px]!`}>
          {state.phase === "busy" ? t("Preparing… {got} of {total} PDFs", { got: state.got, total: state.total }) : t("Download upload package (ZIP)")}
        </button>
        <a href={`/api/manage/${slug}/proceedings`} className="text-[13px]" download>{t("Metadata only (XML)")}</a>
      </div>
      <p className="m-0 text-[13px] text-[#4A5263]">{t("metadata.xml + metadata.csv + final PDFs named by paper ID, with upload steps in README.txt. Upload it yourself in the IEEE portal — Plenary doesn't send anything to IEEE.")}</p>
      {state.phase === "done" ? <p role="status" className={`m-0 ${state.missing.length ? ui.warn : ui.ok}`}>{state.missing.length ? t("Package saved. Missing PDFs: {list}", { list: state.missing.join(", ") }) : t("Package saved with every PDF.")}</p> : null}
      {state.phase === "error" ? <p role="alert" className={`m-0 ${ui.bad}`}>{t(state.msg ?? "Couldn't prepare the package.")}</p> : null}
    </div>
  );
}
