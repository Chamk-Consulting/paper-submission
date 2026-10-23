"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/site/link";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { autocompletion } from "@codemirror/autocomplete";
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { indentWithTab } from "@codemirror/commands";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";
import { createClient } from "@/lib/supabase/browser";
import { PaperSync, type SyncStatus, type Peer } from "@/lib/folio/sync";
import { buildIndex, latexCompletion, type ProjectIndex } from "@/lib/folio/latex-complete";
import type { Diagnostic } from "@/lib/folio/log";
import { PdfView } from "@/components/folio/pdf-view";
import {
  addFolioBinaryFile, addFolioTextFile, deleteFolioFile, renameFolioPaper, setFolioEngine, setFolioMainFile,
} from "@/lib/folio/actions";

export type FolioFile = { id: string; path: string; kind: "text" | "binary"; size: number };
export type FolioPaperProps = {
  paper: { id: string; title: string; engine: "pdflatex" | "lualatex" | "xelatex"; mainFile: string; status: string };
  files: FolioFile[];
  role: "owner" | "editor" | "commenter" | "viewer";
  me: { personId: string; name: string };
};

type Build = {
  running: boolean;
  status: "idle" | "ok" | "error" | "timeout" | "off" | "failed";
  pdfUrl: string | null;
  diagnostics: Diagnostic[];
  pages: number | null;
  ms: number | null;
  cached: boolean;
  at: number | null;
};

const COLORS = ["#1F47A8", "#14603F", "#8E1F17", "#5B2C8C", "#A8600F", "#0F5866", "#B3261E", "#2F5FD0"];
const colorFor = (s: string) => COLORS[[...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];
const TEXT_EXT = /\.(tex|bib|sty|cls|bst|txt|md|cfg|def|clo|bbx|cbx|lbx|csv|tsv|dat|json|ya?ml|typ|lua)$/i;

const STATUS_LABEL: Record<SyncStatus, string> = {
  connecting: "Connecting…", live: "Live", offline: "Offline: edits are kept here", saving: "Saving…", saved: "All changes saved", error: "Not saved yet, retrying",
};

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13.5px", backgroundColor: "#FFFFFF" },
  ".cm-scroller": { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", lineHeight: "1.6" },
  ".cm-gutters": { backgroundColor: "#F7F8F6", borderRight: "1px solid #E4E6EA", color: "#8A92A3" },
  ".cm-activeLine": { backgroundColor: "#F4F7FE" },
  ".cm-activeLineGutter": { backgroundColor: "#E6EDFC" },
  "&.cm-focused": { outline: "none" },
  ".cm-ySelectionInfo": { fontFamily: "'Instrument Sans Variable', sans-serif", fontSize: "11px", padding: "1px 4px", opacity: "1" },
});

export function FolioEditor({ paper, files: initialFiles, role, me }: FolioPaperProps) {
  const supabase = useMemo(() => createClient(), []);
  const canWrite = (role === "owner" || role === "editor") && paper.status === "draft";
  const [files, setFiles] = useState<FolioFile[]>(initialFiles);
  const textFiles = useMemo(() => files.filter((f) => f.kind === "text"), [files]);
  const mainId = files.find((f) => f.path === paper.mainFile)?.id ?? textFiles[0]?.id ?? null;
  const [mainFile, setMainFile] = useState(paper.mainFile);
  const [activeId, setActiveId] = useState<string | null>(mainId);
  const [sync, setSync] = useState<PaperSync | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [title, setTitle] = useState(paper.title);
  const [engine, setEngine] = useState(paper.engine);
  const [auto, setAuto] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [tab, setTab] = useState<"pdf" | "issues">("pdf");
  const [build, setBuild] = useState<Build>({ running: false, status: "idle", pdfUrl: null, diagnostics: [], pages: null, ms: null, cached: false, at: null });
  const [newPath, setNewPath] = useState<string | null>(null);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const indexRef = useRef<ProjectIndex>({ labels: [], cites: [], paths: [], macros: [] });
  const buildTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const again = useRef(false);
  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);
  const readOnly = useMemo(() => new Compartment(), []);

  // ---------- sync ----------
  useEffect(() => {
    const s = new PaperSync(supabase, paper.id, me.personId, { name: me.name, color: colorFor(me.personId) }, canWrite);
    const off = s.onChange(() => { setStatus(s.status); setPeers([...s.peers]); });
    let alive = true;
    s.start(initialFiles.filter((f) => f.kind === "text").map((f) => f.id)).then(() => { if (alive) { setSync(s); setReady(true); } });
    return () => { alive = false; off(); void s.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, paper.id]);

  const refreshIndex = useCallback(() => {
    if (!sync) return;
    indexRef.current = buildIndex(filesRef.current.map((f) => ({ path: f.path, text: f.kind === "text" ? sync.text(f.id) : null })));
  }, [sync]);

  // ---------- build ----------
  const runBuild = useCallback(async (mode: "draft" | "full" = "draft") => {
    if (!sync) return;
    if (inflight.current) { again.current = true; return; }
    inflight.current = true;
    setBuild((b) => ({ ...b, running: true }));
    try {
      await sync.flush();
      const texts = filesRef.current.filter((f) => f.kind === "text").map((f) => ({ path: f.path, content: sync.text(f.id) }));
      const res = await fetch("/api/folio/compile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paperId: paper.id, mode, texts }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBuild((b) => ({ ...b, running: false, status: data.error === "compile_off" ? "off" : "failed", at: Date.now() }));
      } else {
        setBuild((b) => ({
          running: false, status: data.status, pdfUrl: data.pdfUrl ?? b.pdfUrl, diagnostics: data.diagnostics ?? [],
          pages: data.pages ?? b.pages, ms: data.ms ?? null, cached: !!data.cached, at: Date.now(),
        }));
        if (data.status !== "ok" && (data.diagnostics ?? []).some((d: Diagnostic) => d.severity === "error")) setTab("issues");
      }
    } catch {
      setBuild((b) => ({ ...b, running: false, status: "failed", at: Date.now() }));
    } finally {
      inflight.current = false;
      if (again.current) { again.current = false; void runBuild("draft"); }
    }
  }, [sync, paper.id]);

  const scheduleBuild = useCallback(() => {
    refreshIndex();
    if (!auto) return;
    if (buildTimer.current) clearTimeout(buildTimer.current);
    buildTimer.current = setTimeout(() => void runBuild("draft"), 1200);
  }, [auto, runBuild, refreshIndex]);
  const scheduleRef = useRef(scheduleBuild);
  const buildRef = useRef(runBuild);
  useEffect(() => { scheduleRef.current = scheduleBuild; buildRef.current = runBuild; }, [scheduleBuild, runBuild]);

  // First build once the text is loaded.
  useEffect(() => { if (ready) { refreshIndex(); void runBuild("full"); } }, [ready, refreshIndex, runBuild]);

  // ---------- the source editor for the open file ----------
  const activeFile = files.find((f) => f.id === activeId) ?? null;
  useEffect(() => {
    if (!sync || !host.current || !activeFile || activeFile.kind !== "text") return;
    const ytext = sync.doc(activeFile.id).getText("t");
    const awareness = sync.awareness(activeFile.id);
    sync.focus(activeFile.id);
    const undo = new Y.UndoManager(ytext);
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: ytext.toString(),
        extensions: [
          basicSetup,
          StreamLanguage.define(stex),
          EditorView.lineWrapping,
          editorTheme,
          lintGutter(),
          autocompletion({ override: [latexCompletion(() => indexRef.current)], activateOnTyping: true, maxRenderedOptions: 60 }),
          keymap.of([
            indentWithTab,
            { key: "Mod-s", preventDefault: true, run: () => { void buildRef.current("full"); return true; } },
            { key: "Mod-Enter", preventDefault: true, run: () => { void buildRef.current("full"); return true; } },
          ]),
          yCollab(ytext, awareness, { undoManager: undo }),
          readOnly.of(EditorState.readOnly.of(!canWrite)),
          EditorView.updateListener.of((u) => { if (u.docChanged) scheduleRef.current(); }),
        ],
      }),
    });
    view.current = v;
    return () => { v.destroy(); undo.destroy(); if (view.current === v) view.current = null; };
  }, [sync, activeFile?.id, activeFile?.kind, canWrite, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remote edits also trigger a rebuild (debounced), so everyone's preview stays current.
  useEffect(() => {
    if (!sync) return;
    const offs = [...sync.docs.entries()].map(([, d]) => {
      const fn = (_: Uint8Array, origin: unknown) => { if (origin === "remote") scheduleRef.current(); };
      d.on("update", fn);
      return () => d.off("update", fn);
    });
    return () => offs.forEach((f) => f());
  }, [sync, files.length]);

  // Diagnostics of the open file, shown in the gutter and under the text.
  useEffect(() => {
    const v = view.current;
    if (!v || !activeFile) return;
    const mine = build.diagnostics.filter((d) => d.file === activeFile.path && d.line);
    const cm: CmDiagnostic[] = mine.flatMap((d) => {
      if (!d.line || d.line > v.state.doc.lines) return [];
      const ln = v.state.doc.line(d.line);
      return [{ from: ln.from, to: ln.to, severity: d.severity === "info" ? "info" : d.severity, message: d.message }];
    });
    v.dispatch(setDiagnostics(v.state, cm));
  }, [build.diagnostics, activeFile, build.at]);

  const openAt = (path: string | null, line: number | null) => {
    const f = files.find((x) => x.path === (path ?? mainFile));
    if (!f) return;
    setActiveId(f.id);
    if (!line) return;
    // Wait for the editor of that file to mount, then move the cursor.
    let tries = 0;
    const go = () => {
      const v = view.current;
      if (!v || tries > 20) return;
      if (v.state.doc.toString() !== sync?.text(f.id)) { tries++; requestAnimationFrame(go); return; }
      const ln = v.state.doc.line(Math.min(line, v.state.doc.lines));
      v.dispatch({ selection: { anchor: ln.from }, effects: EditorView.scrollIntoView(ln.from, { y: "center" }) });
      v.focus();
    };
    requestAnimationFrame(go);
  };

  // ---------- files ----------
  const createFile = async () => {
    const p = (newPath ?? "").trim().replace(/^\/+/, "");
    if (!p) { setNewPath(null); return; }
    if (!TEXT_EXT.test(p)) { setFileMsg("Use a text file name, for example sections/related-work.tex. Upload images and PDFs instead."); return; }
    const r = await addFolioTextFile(paper.id, p);
    if (!r.ok) { setFileMsg(r.error === "exists" ? "A file with that name already exists." : "Use letters, numbers, - _ . and / only."); return; }
    sync?.doc(r.id);
    setFiles((fs) => [...fs, { id: r.id, path: p, kind: "text" as const, size: 0 }].sort((a, b) => a.path.localeCompare(b.path)));
    setActiveId(r.id);
    setNewPath(null);
    setFileMsg(null);
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    for (const file of Array.from(list)) {
      if (file.size > 50 * 1024 * 1024) { setFileMsg(`${file.name} is over 50 MB.`); continue; }
      const clean = file.name.replace(/[^A-Za-z0-9._-]+/g, "-");
      const isText = TEXT_EXT.test(clean) && file.size < 2_000_000;
      const folder = /\.(png|jpe?g|pdf|eps|svg|gif|tikz)$/i.test(clean) ? "figures/" : /\.bib$/i.test(clean) ? "refs/" : /\.(csv|tsv|dat|json)$/i.test(clean) ? "data/" : "";
      const path = `${folder}${clean}`;
      setFileMsg(`Uploading ${clean}…`);
      if (isText) {
        const r = await addFolioTextFile(paper.id, path);
        if (!r.ok) { setFileMsg(r.error === "exists" ? `${path} already exists.` : `Could not add ${path}.`); continue; }
        const text = await file.text();
        sync?.doc(r.id).getText("t").insert(0, text);
        setFiles((fs) => [...fs, { id: r.id, path, kind: "text" as const, size: text.length }].sort((a, b) => a.path.localeCompare(b.path)));
      } else {
        const buf = new Uint8Array(await file.arrayBuffer());
        const digest = await crypto.subtle.digest("SHA-256", buf);
        const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
        const { error } = await supabase.storage.from("folio").upload(`${paper.id}/files/${path}`, buf, { upsert: true, contentType: file.type || "application/octet-stream" });
        if (error) { setFileMsg(`Could not upload ${clean}.`); continue; }
        const r = await addFolioBinaryFile(paper.id, path, file.size, hash);
        if (!r.ok) { setFileMsg(`Could not add ${clean}.`); continue; }
        setFiles((fs) => [...fs.filter((f) => f.path !== path), { id: r.id, path, kind: "binary" as const, size: file.size }].sort((a, b) => a.path.localeCompare(b.path)));
      }
      setFileMsg(`${path} added.`);
    }
    refreshIndex();
    scheduleBuild();
  };

  const remove = async (f: FolioFile) => {
    if (confirmDel !== f.id) { setConfirmDel(f.id); return; }
    setConfirmDel(null);
    const r = await deleteFolioFile(paper.id, f.id);
    if (!r.ok) { setFileMsg("Could not delete the file."); return; }
    setFiles((fs) => fs.filter((x) => x.id !== f.id));
    if (activeId === f.id) setActiveId(mainId);
    scheduleBuild();
  };

  // ---------- render ----------
  const tree = useMemo(() => {
    const out: { folder: string; items: FolioFile[] }[] = [];
    for (const f of files) {
      const folder = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
      let g = out.find((x) => x.folder === folder);
      if (!g) { g = { folder, items: [] }; out.push(g); }
      g.items.push(f);
    }
    return out.sort((a, b) => (a.folder === "" ? -1 : b.folder === "" ? 1 : a.folder.localeCompare(b.folder)));
  }, [files]);

  const errors = build.diagnostics.filter((d) => d.severity === "error");
  const warnings = build.diagnostics.filter((d) => d.severity === "warning");
  const buildLabel = build.running ? "Building…"
    : build.status === "ok" ? `Built${build.pages ? ` · ${build.pages} page${build.pages === 1 ? "" : "s"}` : ""}${build.cached ? " · unchanged" : build.ms != null ? ` · ${(build.ms / 1000).toFixed(1)} s` : ""}`
    : build.status === "error" ? `${errors.length || 1} error${errors.length === 1 ? "" : "s"}`
    : build.status === "timeout" ? "Stopped after 75 s"
    : build.status === "off" ? "Building is not set up"
    : build.status === "failed" ? "Build failed, try again" : "Not built yet";
  const buildTone = build.running ? "#4A5263" : build.status === "ok" ? "#14603F" : build.status === "idle" ? "#4A5263" : "#B3261E";

  return (
    <div className="flex h-dvh flex-col bg-[#F5F6F3] text-[#121826]">
      {/* top bar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-[#DADDE3] bg-white px-3 py-2">
        <Link href="/folio" className="text-[13px] no-underline" aria-label="Back to my papers">← Folio</Link>
        <input
          aria-label="Paper title" value={title} disabled={!canWrite}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title.trim() && title !== paper.title) void renameFolioPaper(paper.id, title); }}
          className="min-w-[160px] flex-1 rounded-[4px] border border-transparent bg-transparent px-2 py-1 font-serif text-[18px] hover:border-[#DADDE3] focus:border-[#2F5FD0] focus:outline-none"
        />
        <span className="flex items-center gap-1" aria-label="People in this paper">
          {peers.slice(0, 5).map((p) => (
            <span key={p.clientId} title={`${p.name}${p.fileId ? ` · ${files.find((f) => f.id === p.fileId)?.path ?? ""}` : ""}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: p.color }}>
              {p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
          ))}
        </span>
        <span role="status" className="text-[12px]" style={{ color: status === "error" || status === "offline" ? "#B3261E" : "#4A5263" }}>{STATUS_LABEL[status]}</span>
        <select aria-label="TeX engine" value={engine} disabled={!canWrite}
          onChange={(e) => { const v = e.target.value as typeof engine; setEngine(v); void setFolioEngine(paper.id, v).then(() => runBuild("full")); }}
          className="h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2 text-[12.5px]">
          <option value="pdflatex">pdfLaTeX</option><option value="lualatex">LuaLaTeX</option><option value="xelatex">XeLaTeX</option>
        </select>
        <label className="flex items-center gap-1 text-[12.5px]"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-build</label>
        <button type="button" onClick={() => void runBuild("full")} disabled={build.running || !ready}
          className="h-8 rounded-[4px] border-0 bg-[#0E1B3D] px-3 text-[13px] font-semibold text-white disabled:opacity-60" title="Build (Ctrl+S)">
          {build.running ? "Building…" : "Build PDF"}
        </button>
        {build.pdfUrl ? <a href={build.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] text-[#121826] no-underline">Download PDF</a> : null}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* files */}
        <nav aria-label="Project files" className="flex w-[230px] shrink-0 flex-col border-r border-[#DADDE3] bg-white">
          <div className="flex items-center justify-between border-b border-[#EEF0EC] px-3 py-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#4A5263]">Files</span>
            {canWrite ? (
              <span className="flex gap-1">
                <button type="button" onClick={() => { setNewPath("sections/new-section.tex"); setFileMsg(null); }} className="h-6 rounded-[3px] border border-[#B7BDC9] bg-white px-1.5 text-[11.5px]">+ File</button>
                <label className="inline-flex h-6 cursor-pointer items-center rounded-[3px] border border-[#B7BDC9] bg-white px-1.5 text-[11.5px]">
                  Upload<input type="file" multiple className="sr-only" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
                </label>
              </span>
            ) : null}
          </div>
          {newPath !== null ? (
            <form onSubmit={(e) => { e.preventDefault(); void createFile(); }} className="border-b border-[#EEF0EC] p-2">
              <label className="block text-[11.5px] text-[#4A5263]">New file path
                <input autoFocus value={newPath} onChange={(e) => setNewPath(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setNewPath(null); }}
                  className="mt-1 h-7 w-full rounded-[3px] border border-[#B7BDC9] px-1.5 font-mono text-[12px]" />
              </label>
              <div className="mt-1 flex gap-1"><button type="submit" className="h-6 rounded-[3px] border-0 bg-[#0E1B3D] px-2 text-[11.5px] text-white">Create</button><button type="button" onClick={() => setNewPath(null)} className="h-6 rounded-[3px] border border-[#B7BDC9] bg-white px-2 text-[11.5px]">Cancel</button></div>
            </form>
          ) : null}
          {fileMsg ? <p role="status" className="m-0 border-b border-[#EEF0EC] px-3 py-1.5 text-[11.5px] text-[#4A5263]">{fileMsg}</p> : null}
          <ul className="m-0 flex-1 list-none overflow-auto p-1.5">
            {tree.map((g) => (
              <li key={g.folder || "/"}>
                {g.folder ? <p className="m-0 px-1.5 pt-2 pb-0.5 font-mono text-[11px] text-[#8A92A3]">{g.folder}/</p> : null}
                <ul className="m-0 list-none p-0">
                  {g.items.map((f) => {
                    const name = f.path.slice(f.path.lastIndexOf("/") + 1);
                    const on = f.id === activeId;
                    const issues = build.diagnostics.filter((d) => d.file === f.path && d.severity === "error").length;
                    const peer = peers.find((p) => p.fileId === f.id);
                    return (
                      <li key={f.id} className="group flex items-center">
                        <button type="button" onClick={() => setActiveId(f.id)} aria-current={on ? "true" : undefined}
                          className={`flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-[4px] border-0 px-1.5 text-left font-mono text-[12.5px] ${on ? "bg-[#E6EDFC] font-semibold" : "bg-transparent hover:bg-[#F4F5F2]"}`}
                          style={{ paddingLeft: g.folder ? 14 : 6 }}>
                          <span className="min-w-0 flex-1 truncate">{name}</span>
                          {f.path === mainFile ? <span className="text-[10px] font-sans text-[#14603F]">main</span> : null}
                          {peer ? <span aria-label={`${peer.name} is here`} className="h-2 w-2 rounded-full" style={{ background: peer.color }} /> : null}
                          {issues ? <span className="rounded-[3px] bg-[#FDECEA] px-1 font-sans text-[10px] text-[#8E1F17]">{issues}</span> : null}
                        </button>
                        {canWrite && f.path !== mainFile ? (
                          <button type="button" onClick={() => void remove(f)} onBlur={() => setConfirmDel(null)}
                            className={`h-6 shrink-0 rounded-[3px] border-0 px-1 text-[11px] ${confirmDel === f.id ? "bg-[#B3261E] text-white" : "bg-transparent text-[#8A92A3] opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
                            aria-label={`Delete ${f.path}`}>{confirmDel === f.id ? "Delete?" : "×"}</button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          {activeFile?.kind === "text" && activeFile.path.endsWith(".tex") && activeFile.path !== mainFile && canWrite ? (
            <button type="button" onClick={() => { setMainFile(activeFile.path); void setFolioMainFile(paper.id, activeFile.path).then(() => runBuild("full")); }}
              className="m-2 h-7 rounded-[3px] border border-[#B7BDC9] bg-white text-[11.5px]">Make {activeFile.path} the main file</button>
          ) : null}
        </nav>

        {/* source */}
        <section aria-label="Source" className="flex min-w-0 flex-1 flex-col border-r border-[#DADDE3]">
          <div className="flex items-center gap-2 border-b border-[#EEF0EC] bg-white px-3 py-1.5 text-[12px] text-[#4A5263]">
            <span className="font-mono text-[#121826]">{activeFile?.path ?? "—"}</span>
            {!canWrite ? <span className="rounded-[3px] bg-[#F1F2EE] px-1.5">Read only</span> : null}
            <span className="ml-auto">Ctrl+S builds · Ctrl+Space completes · \ for commands</span>
          </div>
          <div className="relative min-h-0 flex-1">
            {!ready ? <p className="m-0 p-4 text-[13px] text-[#4A5263]">Opening the paper…</p> : null}
            {activeFile?.kind === "binary" ? <BinaryInfo paperId={paper.id} file={activeFile} /> : <div ref={host} className="h-full" />}
          </div>
        </section>

        {/* result */}
        <section aria-label="Result" className="flex w-[44%] min-w-[320px] flex-col">
          <div className="flex items-center gap-1 border-b border-[#EEF0EC] bg-white px-2 py-1.5">
            <div role="tablist" className="flex gap-1">
              {(["pdf", "issues"] as const).map((t) => (
                <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={`h-7 rounded-[4px] border-0 px-2.5 text-[12.5px] ${tab === t ? "bg-[#0E1B3D] font-semibold text-white" : "bg-transparent text-[#121826] hover:bg-[#F4F5F2]"}`}>
                  {t === "pdf" ? "PDF" : `Issues${build.diagnostics.length ? ` (${errors.length + warnings.length})` : ""}`}
                </button>
              ))}
            </div>
            <span className="ml-2 text-[12px] font-semibold" style={{ color: buildTone }} role="status">{buildLabel}</span>
            {tab === "pdf" ? (
              <span className="ml-auto flex items-center gap-1">
                <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} className="h-7 w-7 rounded-[3px] border border-[#B7BDC9] bg-white text-[13px]">−</button>
                <span className="w-10 text-center text-[12px]">{Math.round(zoom * 100)}%</span>
                <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))} className="h-7 w-7 rounded-[3px] border border-[#B7BDC9] bg-white text-[13px]">+</button>
              </span>
            ) : null}
          </div>
          {build.status === "error" && build.pdfUrl && tab === "pdf" ? (
            <button type="button" onClick={() => setTab("issues")} className="border-0 bg-[#FDECEA] px-3 py-1.5 text-left text-[12.5px] text-[#8E1F17]">
              The last build has errors; the PDF may be incomplete. See issues →
            </button>
          ) : null}
          <div className="min-h-0 flex-1">
            {tab === "pdf" ? <PdfView url={build.pdfUrl} zoom={zoom} /> : (
              <div className="h-full overflow-auto bg-white p-2">
                {build.status === "off" ? <p className="m-2 text-[13px]">Building PDFs is not switched on for this site yet.</p> : null}
                {!build.diagnostics.length && build.status === "ok" ? <p className="m-2 text-[13px] text-[#14603F]">No errors or warnings.</p> : null}
                <ul className="m-0 list-none p-0">
                  {build.diagnostics.map((d, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => openAt(d.file, d.line)} disabled={!d.file}
                        className="flex w-full gap-2 rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-[12.5px] hover:bg-[#F4F5F2]">
                        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: d.severity === "error" ? "#B3261E" : d.severity === "warning" ? "#A8600F" : "#8A92A3" }} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block">{d.message}</span>
                          {d.file ? <span className="font-mono text-[11px] text-[#4A5263]">{d.file}{d.line ? `:${d.line}` : ""}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function BinaryInfo({ paperId, file }: { paperId: string; file: FolioFile }) {
  const [url, setUrl] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    let alive = true;
    supabase.storage.from("folio").createSignedUrl(`${paperId}/files/${file.path}`, 600).then(({ data }) => { if (alive) setUrl(data?.signedUrl ?? null); });
    return () => { alive = false; };
  }, [supabase, paperId, file.path]);
  const image = /\.(png|jpe?g|gif|svg|webp)$/i.test(file.path);
  return (
    <div className="h-full overflow-auto p-4">
      <p className="m-0 font-mono text-[13px]">{file.path}</p>
      <p className="m-0 mt-1 text-[12.5px] text-[#4A5263]">{(file.size / 1024).toFixed(0)} KB · use it with <code className="font-mono">\includegraphics{"{"}{file.path}{"}"}</code></p>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage link, shown as is */}
      {image && url ? <img src={url} alt={file.path} className="mt-3 max-w-full border border-[#DADDE3] bg-white" /> : null}
      {!image && url ? <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13px]">Open the file</a> : null}
    </div>
  );
}
