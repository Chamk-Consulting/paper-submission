/*
 * Rich text is stored as Markdown with LaTeX maths ($…$), in the same text columns as before.
 * These helpers give the plain version: for word counts, exports (IEEE Xplore, program book), emails and AI.
 */

/** Markdown → readable plain text. Maths stays as $…$ (that is how IEEE and LaTeX expect it). */
export function mdToPlain(md: string | null | undefined): string {
  if (!md) return "";
  return md
    .replace(/\r\n/g, "\n")
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text: string, url: string) => (text === url ? url : `${text} (${url})`))
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\\*$])\*(?!\s)([^*\n]+?)\*/g, "$1$2")
    .replace(/(^|[^\\\w$])_(?!\s)([^_\n]+?)_(?!\w)/g, "$1$2")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** One paragraph for publishers that accept only plain text: list items become "a; b; c." and lines join. */
export function mdToParagraph(md: string | null | undefined): string {
  const lines = mdToPlain(md).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let out = "";
  for (const raw of lines) {
    const item = /^(•|\d+[.)])\s+/.test(raw);
    const line = raw.replace(/^(•|\d+[.)])\s+/, "");
    if (!out) { out = line; continue; }
    const ended = /[.;:!?]$/.test(out);
    out += (ended ? " " : item ? "; " : ". ") + line;
  }
  return out;
}

/** Words as a reader counts them (formatting marks excluded). */
export const wordCount = (md: string | null | undefined) => {
  const s = mdToPlain(md).replace(/[•]/g, " ").trim();
  return s ? s.split(/\s+/).length : 0;
};
