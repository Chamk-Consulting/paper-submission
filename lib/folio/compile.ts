import "server-only";
import { createHash } from "node:crypto";
import { Sandbox } from "@vercel/sandbox";
import { parseLatexLog, type Diagnostic } from "@/lib/folio/log";

/**
 * Builds a Folio paper in a Vercel Sandbox restored from the TeX Live snapshot (FOLIO_TEX_SNAPSHOT).
 * One named sandbox per paper is kept warm for a while, so later builds reuse .aux/.bbl and start fast.
 * The sandbox has no network, LaTeX cannot run shell commands, and file reads/writes stay inside the project.
 */

/** A project file: its hash is known up front; the bytes load only when the sandbox lacks this version. */
export type CompileFile = { path: string; hash: string; load: () => Promise<Uint8Array> };

export const sha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
export type Engine = "pdflatex" | "lualatex" | "xelatex";
export type CompileResult = {
  status: "ok" | "error" | "timeout";
  pdf: Uint8Array | null;
  synctex: Uint8Array | null;
  diagnostics: Diagnostic[];
  pages: number | null;
  ms: number;
  logTail: string;
};

const WORK = "/vercel/work";
const WARM_MS = 15 * 60 * 1000;
const BUILD_LIMIT_MS = 75 * 1000;

export function inputHash(files: CompileFile[], engine: string, main: string, mode: string): string {
  const h = createHash("sha256");
  h.update(`${engine}\0${main}\0${mode}\0`);
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    h.update(f.path);
    h.update("\0");
    h.update(f.hash);
  }
  return h.digest("hex");
}

/** A safe relative path inside the project (no absolute paths, no "..", plain characters). */
export function safePath(p: string): boolean {
  return /^[A-Za-z0-9._/-]{1,240}$/.test(p) && !p.startsWith("/") && !p.split("/").some((s) => s === ".." || s === "");
}

let snapshotCache: { id: string; at: number } | null = null;
/** The TeX Live snapshot: the never-expiring copy the daily cron records, else the one set in the environment. */
async function texSnapshot(): Promise<string | undefined> {
  if (snapshotCache && Date.now() - snapshotCache.at < 10 * 60 * 1000) return snapshotCache.id;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient().from("folio_settings").select("value").eq("key", "tex_snapshot").maybeSingle();
  const id = data?.value ?? process.env.FOLIO_TEX_SNAPSHOT;
  if (id) snapshotCache = { id, at: Date.now() };
  return id;
}

async function sandboxFor(paperId: string): Promise<Sandbox> {
  const snapshotId = await texSnapshot();
  if (!snapshotId) throw new Error("compile_off");
  const name = `folio-${paperId}`;
  const create = () =>
    Sandbox.create({
      name,
      source: { type: "snapshot", snapshotId },
      persistent: false,
      timeout: WARM_MS,
      resources: { vcpus: 2 },
      networkPolicy: "deny-all",
      tags: { app: "folio", paper: paperId },
    });
  try {
    const sb = await Sandbox.get({ name, resume: true });
    await sb.extendTimeout(5 * 60 * 1000).catch(() => {});
    return sb;
  } catch {
    try {
      return await create();
    } catch (e) {
      // A stale sandbox with that name (stopped, expired source) — remove it and start clean.
      const old = await Sandbox.get({ name }).catch(() => null);
      if (old) await old.delete().catch(() => {});
      if (!old) throw e;
      return await create();
    }
  }
}

export async function compileProject(opts: {
  paperId: string;
  files: CompileFile[];
  main: string;
  engine: Engine;
  mode: "draft" | "full";
}): Promise<CompileResult> {
  const t0 = Date.now();
  const sb = await sandboxFor(opts.paperId);
  const dir = `${WORK}/${opts.paperId}`;
  // Write only what changed since the last build (a manifest of hashes lives next to the project).
  let manifest: Record<string, string> = {};
  try {
    const buf = await sb.readFileToBuffer({ path: `${dir}/.folio-manifest.json` });
    if (buf) manifest = JSON.parse(Buffer.from(buf).toString("utf8"));
  } catch { /* first build */ }
  const next: Record<string, string> = {};
  const todo = opts.files.filter((f) => { next[f.path] = f.hash; return manifest[f.path] !== f.hash; });
  const changed: { path: string; content: Buffer }[] = await Promise.all(
    todo.map(async (f) => ({ path: `${dir}/${f.path}`, content: Buffer.from(await f.load()) })),
  );
  const removed = Object.keys(manifest).filter((p) => !(p in next));
  if (!Object.keys(manifest).length) await sb.runCommand("mkdir", ["-p", dir]);
  if (removed.length) await sb.runCommand("rm", ["-f", "--", ...removed.map((p) => `${dir}/${p}`)]);
  changed.push({ path: `${dir}/.folio-manifest.json`, content: Buffer.from(JSON.stringify(next)) });
  await sb.writeFiles(changed);

  const engineFlag = opts.engine === "lualatex" ? "-lualatex" : opts.engine === "xelatex" ? "-xelatex" : "-pdf";
  const job = opts.main.replace(/\.tex$/, "");
  // Draft builds: one pass when nothing else changed; full builds: run bibliography and repeat until stable.
  const args = [
    engineFlag, "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "-no-shell-escape",
    ...(opts.mode === "draft" ? ["-bibtex-cond", "-max-repeat=3"] : ["-bibtex", "-max-repeat=5"]),
    "-f", opts.main,
  ];
  const env = { openin_any: "p", openout_any: "p", shell_escape: "f", max_print_line: "1000", error_line: "254", half_error_line: "238" };
  let status: CompileResult["status"] = "ok";
  let exit = 0;
  try {
    const res = await sb.runCommand({ cmd: "latexmk", args, cwd: dir, env, timeoutMs: BUILD_LIMIT_MS });
    exit = res.exitCode;
    if (exit === 137 || Date.now() - t0 > BUILD_LIMIT_MS) status = "timeout";
  } catch {
    status = "timeout";
  }
  const read = async (p: string) => {
    try {
      const b = await sb.readFileToBuffer({ path: `${dir}/${p}` });
      return b ? new Uint8Array(b) : null;
    } catch { return null; }
  };
  const [pdf, logBuf, synctex] = await Promise.all([read(`${job}.pdf`), read(`${job}.log`), read(`${job}.synctex.gz`)]);
  const log = logBuf ? Buffer.from(logBuf).toString("latin1") : "";
  const { diagnostics, pages } = parseLatexLog(log, opts.main);
  if (status !== "timeout" && (exit !== 0 || !pdf || diagnostics.some((d) => d.severity === "error"))) status = "error";
  return { status, pdf, synctex, diagnostics, pages, ms: Date.now() - t0, logTail: log.slice(-6000) };
}
