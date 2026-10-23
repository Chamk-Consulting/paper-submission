"use client";

import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { fromBase64, fromBytea, toBase64, toBytea } from "@/lib/folio/bytes";

/**
 * Live co-editing for one Folio paper.
 * - Each text file is a Y.Doc with one Y.Text ("t").
 * - Edits go to co-authors at once over the private Realtime channel "folio:{paperId}" (broadcast),
 *   and are saved in Postgres (folio_updates) about once a second, merged per file.
 * - Opening the paper replays the latest snapshot of each file plus the updates after it; after a dropped
 *   connection the client re-reads what it missed from Postgres, so nothing depends on being online at the same time.
 * - Cursors and selections travel as Yjs awareness messages on the same channel.
 */

export type SyncStatus = "connecting" | "live" | "offline" | "saving" | "saved" | "error";
export type Peer = { clientId: number; name: string; color: string; fileId: string | null };

const REMOTE = "remote";
const LOAD = "load";
const FLUSH_MS = 900;
const COMPACT_AFTER = 300;

export class PaperSync {
  readonly docs = new Map<string, Y.Doc>();
  private aw = new Map<string, Awareness>();
  private pending = new Map<string, Uint8Array[]>();
  private lastId = 0;
  private channel: RealtimeChannel | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private destroyed = false;
  status: SyncStatus = "connecting";
  peers: Peer[] = [];
  private everLive = false;

  constructor(
    private supabase: SupabaseClient,
    readonly paperId: string,
    private personId: string,
    readonly user: { name: string; color: string },
    readonly canWrite: boolean,
  ) {}

  onChange(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { for (const fn of this.listeners) fn(); }
  private setStatus(s: SyncStatus) { if (this.status !== s) { this.status = s; this.emit(); } }
  get unsaved() { for (const v of this.pending.values()) if (v.length) return true; return false; }

  doc(fileId: string): Y.Doc {
    let d = this.docs.get(fileId);
    if (!d) {
      d = new Y.Doc();
      d.on("update", (u: Uint8Array, origin: unknown) => {
        if (origin === REMOTE || origin === LOAD) return;
        if (!this.canWrite) return;
        this.channel?.send({ type: "broadcast", event: "u", payload: { f: fileId, u: toBase64(u) } });
        const q = this.pending.get(fileId) ?? [];
        q.push(u);
        this.pending.set(fileId, q);
        this.scheduleFlush();
      });
      this.docs.set(fileId, d);
    }
    return d;
  }

  awareness(fileId: string): Awareness {
    let a = this.aw.get(fileId);
    if (!a) {
      a = new Awareness(this.doc(fileId));
      a.setLocalStateField("user", { name: this.user.name, color: this.user.color, colorLight: `${this.user.color}33` });
      a.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        if (origin === REMOTE) { this.refreshPeers(); return; }
        const changed = [...added, ...updated, ...removed];
        this.channel?.send({ type: "broadcast", event: "a", payload: { f: fileId, u: toBase64(encodeAwarenessUpdate(a!, changed)) } });
      });
      this.aw.set(fileId, a);
    }
    return a;
  }

  /** Leave every file but this one, so co-authors see where you are. */
  focus(fileId: string | null) {
    for (const [fid, a] of this.aw) if (fid !== fileId) a.setLocalState(null);
    if (fileId) {
      const a = this.awareness(fileId);
      if (!a.getLocalState()) a.setLocalStateField("user", { name: this.user.name, color: this.user.color, colorLight: `${this.user.color}33` });
    }
    this.refreshPeers();
  }

  private refreshPeers() {
    const peers: Peer[] = [];
    const seen = new Set<number>();
    for (const [fid, a] of this.aw) {
      a.getStates().forEach((s, id) => {
        if (id === a.clientID || seen.has(id) || !s?.user) return;
        seen.add(id);
        peers.push({ clientId: id, name: s.user.name, color: s.user.color, fileId: fid });
      });
    }
    this.peers = peers;
    this.emit();
  }

  /** Load every text file's state, then join the live channel. */
  async start(fileIds: string[]) {
    for (const id of fileIds) this.doc(id);
    await this.catchUp(true);
    await this.join();
    // Belt and braces: re-read the database now and then, in case a broadcast was missed.
    this.pollTimer = setInterval(() => { void this.catchUp(false); }, 20_000);
    window.addEventListener("beforeunload", this.beforeUnload);
  }

  private beforeUnload = (e: BeforeUnloadEvent) => {
    if (this.unsaved) { void this.flush(); e.preventDefault(); }
  };

  /** Apply what the database has that this browser has not seen yet. */
  async catchUp(initial: boolean) {
    if (initial) {
      const { data: snaps } = await this.supabase.from("folio_snapshots")
        .select("file_id, state, upto_update_id").eq("paper_id", this.paperId).is("label", null).order("id", { ascending: false }).limit(500);
      const done = new Set<string>();
      for (const s of snaps ?? []) {
        if (!s.file_id || done.has(s.file_id) || !s.state) continue;
        done.add(s.file_id);
        Y.applyUpdate(this.doc(s.file_id), fromBytea(s.state), LOAD);
      }
      // Updates after the oldest snapshot used; Yjs ignores what a doc already has.
      // A file without a snapshot needs every update from the start.
      const used = (snaps ?? []).filter((s) => s.file_id && s.state);
      const allSnapped = [...this.docs.keys()].every((fid) => done.has(fid));
      this.lastId = allSnapped && used.length ? Math.min(...used.map((s) => Number(s.upto_update_id))) : 0;
    }
    let from = this.lastId;
    const counts = new Map<string, number>();
    for (;;) {
      const { data, error } = await this.supabase.from("folio_updates")
        .select("id, file_id, update").eq("paper_id", this.paperId).gt("id", from).order("id").limit(1000);
      if (error) { if (initial) this.setStatus("error"); return; }
      for (const r of data ?? []) {
        Y.applyUpdate(this.doc(r.file_id), fromBytea(r.update), LOAD);
        counts.set(r.file_id, (counts.get(r.file_id) ?? 0) + 1);
        from = Number(r.id);
      }
      if (!data || data.length < 1000) break;
    }
    this.lastId = from;
    if (initial && this.canWrite) void this.compact(counts);
  }

  /** Files with a long tail of small updates get a snapshot, so the next open is quick. */
  private async compact(counts: Map<string, number>) {
    const rows = [...counts].filter(([, n]) => n >= COMPACT_AFTER).map(([fid]) => ({
      paper_id: this.paperId, file_id: fid, upto_update_id: this.lastId,
      state: toBytea(Y.encodeStateAsUpdate(this.doc(fid))), created_by: this.personId,
    }));
    if (rows.length) await this.supabase.from("folio_snapshots").insert(rows);
  }

  private async join() {
    await this.supabase.realtime.setAuth();
    const ch = this.supabase.channel(`folio:${this.paperId}`, { config: { private: true, broadcast: { self: false } } });
    ch.on("broadcast", { event: "u" }, ({ payload }) => {
      const p = payload as { f: string; u: string };
      Y.applyUpdate(this.doc(p.f), fromBase64(p.u), REMOTE);
    });
    ch.on("broadcast", { event: "a" }, ({ payload }) => {
      const p = payload as { f: string; u: string };
      applyAwarenessUpdate(this.awareness(p.f), fromBase64(p.u), REMOTE);
    });
    ch.on("broadcast", { event: "hello" }, () => {
      // Someone joined: tell them where we are.
      for (const [fid, a] of this.aw) if (a.getLocalState()) {
        ch.send({ type: "broadcast", event: "a", payload: { f: fid, u: toBase64(encodeAwarenessUpdate(a, [a.clientID])) } });
      }
    });
    ch.subscribe((state) => {
      if (this.destroyed) return;
      if (state === "SUBSCRIBED") {
        if (this.everLive) void this.catchUp(false);
        this.everLive = true;
        this.setStatus(this.unsaved ? "saving" : "live");
        ch.send({ type: "broadcast", event: "hello", payload: {} });
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
        this.setStatus("offline");
      }
    });
    this.channel = ch;
  }

  private scheduleFlush() {
    if (this.status === "live" || this.status === "saved") this.setStatus("saving");
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => { this.flushTimer = null; void this.flush(); }, FLUSH_MS);
  }

  async flush() {
    const batch = [...this.pending].filter(([, q]) => q.length);
    if (!batch.length) return;
    this.pending = new Map();
    const rows = batch.map(([fid, q]) => ({
      paper_id: this.paperId, file_id: fid, author_id: this.personId,
      update: toBytea(q.length === 1 ? q[0] : Y.mergeUpdates(q)),
    }));
    const { data, error } = await this.supabase.from("folio_updates").insert(rows).select("id");
    if (error) {
      // Keep the edits and try again; they are still in this browser.
      for (const [fid, q] of batch) this.pending.set(fid, [...q, ...(this.pending.get(fid) ?? [])]);
      this.setStatus("error");
      setTimeout(() => this.scheduleFlush(), 3000);
      return;
    }
    for (const r of data ?? []) this.lastId = Math.max(this.lastId, Number(r.id));
    this.setStatus(this.unsaved ? "saving" : this.channel ? "saved" : "offline");
  }

  text(fileId: string): string { return this.doc(fileId).getText("t").toString(); }

  async destroy() {
    this.destroyed = true;
    window.removeEventListener("beforeunload", this.beforeUnload);
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    await this.flush();
    for (const a of this.aw.values()) removeAwarenessStates(a, [a.clientID], "destroy");
    if (this.channel) await this.supabase.removeChannel(this.channel);
    for (const d of this.docs.values()) d.destroy();
  }
}
