import "server-only";
import { strToU8, zipSync, type Zippable } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * ST05 — builds the person's export ZIP with THEIR session (RLS applies, so only files they may read go in)
 * and stores it at exports/{person}/{request}.zip. Storage takes up to 50 MB per file, so PDFs are added
 * until the budget is used and the rest are listed in README.txt with the paper they belong to.
 */
const BUDGET = 45 * 1024 * 1024;

type ExportFile = { role: string; file_name: string; version: number; current: boolean; bytes: number; storage_path: string };
type ExportPaper = { id: string; number: number | null; title: string; files: ExportFile[] };
type ExportData = {
  papers: ExportPaper[];
  sign_ins: { at: string; method: string; place: string | null; device: string | null; result: string }[];
  consents: { kind: string; granted: boolean; recorded_at: string }[];
  [k: string]: unknown;
};

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const safeName = (s: string) => s.replace(/[^\w.\-]+/g, "_").slice(0, 80);
const json = (v: unknown) => strToU8(JSON.stringify(v ?? null, null, 2));

export type ExportResult = { path: string; bytes: number; included: number; skipped: number };

export async function buildExport(supabase: SupabaseClient, personId: string, requestId: string): Promise<ExportResult> {
  const { data, error } = await supabase.rpc("my_export_data");
  if (error || !data) throw new Error(error?.message ?? "no data");
  const d = data as ExportData;

  const files: Zippable = {};
  const { papers, sign_ins, consents, ...rest } = d;
  files["profile.json"] = json({ profile: rest.profile, emails: rest.emails, affiliations: rest.affiliations, topics: rest.topics, notification_prefs: rest.notification_prefs, followed_venues: rest.followed_venues });
  files["papers.json"] = json(papers.map((p) => ({ ...p, files: p.files.map((f) => ({ ...f, storage_path: undefined })) })));
  files["reviews.json"] = json(rest.reviews);
  files["inbox.json"] = json(rest.inbox);
  files["registrations.json"] = json(rest.registrations);
  files["requests.json"] = json(rest.requests);
  const rows = [
    ["type", "at", "detail", "place", "device", "result"],
    ...sign_ins.map((e) => ["sign_in", e.at, e.method, e.place, e.device, e.result]),
    ...consents.map((c) => ["consent", c.recorded_at, c.kind, "", "", c.granted ? "granted" : "withdrawn"]),
  ];
  files["activity.csv"] = strToU8(rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n");

  // PDFs and other uploads, newest papers first, until the size budget is reached
  let used = 0, included = 0;
  const skipped: string[] = [];
  for (const p of papers) {
    const label = p.number ? `#${String(p.number).padStart(4, "0")}` : p.id.slice(0, 8);
    for (const f of p.files) {
      const name = `papers/${safeName(label)}/${safeName(f.role)}-v${f.version}-${safeName(f.file_name)}`;
      if (used + (f.bytes ?? 0) > BUDGET) { skipped.push(`${name} (${label} ${p.title})`); continue; }
      const { data: blob } = await supabase.storage.from("papers").download(f.storage_path);
      if (!blob) { skipped.push(`${name} (not available)`); continue; }
      const buf = new Uint8Array(await blob.arrayBuffer());
      used += buf.byteLength;
      files[name] = [buf, { level: 0 }];
      included++;
    }
  }

  const readme = [
    "Your Plenary export",
    `Generated: ${new Date().toISOString()}`,
    "",
    "profile.json        your profile, emails, affiliations, topics and settings",
    "papers.json         every paper you are an author of, with its authors and file list",
    "papers/             the files you uploaded (all versions)",
    "reviews.json        reviews you wrote (scores and comments)",
    "inbox.json          messages in threads you are part of",
    "registrations.json  event registrations",
    "activity.csv        sign-ins and consent changes",
    "",
    "Not included: other people's reviews of your papers before they are released, and reviewer identities in blind venues.",
    ...(skipped.length ? ["", "Files left out to keep the ZIP under 50 MB (download them from each paper's page):", ...skipped.map((s) => `- ${s}`)] : []),
  ].join("\n");
  files["README.txt"] = strToU8(readme + "\n");

  const zip = zipSync(files, { level: 6 });
  const path = `${personId}/${requestId}.zip`;
  const up = await supabase.storage.from("exports").upload(path, zip, { contentType: "application/zip", upsert: true });
  if (up.error) throw new Error(up.error.message);
  return { path, bytes: zip.byteLength, included, skipped: skipped.length };
}
