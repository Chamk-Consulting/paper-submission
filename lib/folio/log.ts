/** Parse a LaTeX .log (run with -file-line-error) into diagnostics people can click. Pure: no I/O. */

export type Diagnostic = {
  severity: "error" | "warning" | "info";
  kind: "error" | "undefined-ref" | "undefined-cite" | "overfull" | "underfull" | "font" | "warning";
  file: string | null;
  line: number | null;
  message: string;
};

const FILE_LINE = /^(\.\/)?([^:\s][^:]*\.(?:tex|sty|cls|bib|bbl)):(\d+): (.*)$/;

export function parseLatexLog(log: string, mainFile = "main.tex"): { diagnostics: Diagnostic[]; pages: number | null } {
  const lines = log.replace(/\r/g, "").split("\n");
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  const push = (d: Diagnostic) => {
    const k = `${d.kind}|${d.file}|${d.line}|${d.message}`;
    if (seen.has(k) || out.length >= 300) return;
    seen.add(k);
    out.push(d);
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const fl = FILE_LINE.exec(l);
    if (fl) {
      // Errors span a few lines: the message, then "l.<n> <context>". Keep the first line plus help text.
      let message = fl[4].trim();
      const next = lines[i + 1] ?? "";
      if (next && !next.startsWith("l.") && !FILE_LINE.test(next) && next.trim().length > 0 && next.length < 200) message += ` ${next.trim()}`;
      push({ severity: "error", kind: "error", file: fl[2], line: Number(fl[3]), message });
      continue;
    }
    if (l.startsWith("! ")) {
      const m = /^l\.(\d+)/.exec(lines.slice(i + 1, i + 8).find((x) => /^l\.\d+/.test(x)) ?? "");
      push({ severity: "error", kind: "error", file: null, line: m ? Number(m[1]) : null, message: l.slice(2).trim() });
      continue;
    }
    let m = /LaTeX Warning: Reference `([^']+)' on page \d+ undefined on input line (\d+)/.exec(l);
    if (m) { push({ severity: "warning", kind: "undefined-ref", file: null, line: Number(m[2]), message: `Reference "${m[1]}" is not defined` }); continue; }
    m = /(?:LaTeX|Package natbib|Package biblatex) Warning: Citation `([^']+)'(?: on page \d+)? undefined(?: on input line (\d+))?/.exec(l);
    if (m) { push({ severity: "warning", kind: "undefined-cite", file: null, line: m[2] ? Number(m[2]) : null, message: `Citation "${m[1]}" is not in the bibliography` }); continue; }
    m = /^(Overfull|Underfull) \\([hv])box \(([^)]+)\) (?:in paragraph at lines (\d+)--(\d+)|detected at line (\d+)|has occurred while \\output is active)/.exec(l);
    if (m) {
      const over = m[1] === "Overfull";
      if (!over && !/badness 10000/.test(m[3])) continue; // only the worst underfull boxes are worth showing
      push({ severity: over ? "warning" : "info", kind: over ? "overfull" : "underfull", file: null, line: m[4] ? Number(m[4]) : m[6] ? Number(m[6]) : null, message: `${m[1]} ${m[2]}box (${m[3]})` });
      continue;
    }
    m = /LaTeX Font Warning: (.*)/.exec(l);
    if (m) { push({ severity: "info", kind: "font", file: null, line: null, message: m[1].trim() }); continue; }
    m = /^(?:LaTeX|Package (\S+)|Class (\S+)) Warning: (.*)$/.exec(l);
    if (m) {
      let msg = m[3].trim();
      // Warnings continue on lines that start with "(pkg)" padding.
      for (let j = i + 1; j < Math.min(lines.length, i + 5) && /^\(\S+\)\s+/.test(lines[j]); j++) msg += ` ${lines[j].replace(/^\(\S+\)\s+/, "")}`;
      const ln = /on input line (\d+)/.exec(msg);
      if (/There were undefined references|Label\(s\) may have changed|Rerun to get/.test(msg)) continue;
      push({ severity: "warning", kind: "warning", file: null, line: ln ? Number(ln[1]) : null, message: (m[1] || m[2] ? `${m[1] ?? m[2]}: ` : "") + msg.replace(/\s*on input line \d+\.?/, "") });
    }
  }

  // Lines with no file belong to the main file in most papers; the editor shows them there.
  for (const d of out) if (!d.file && d.line != null) d.file = mainFile;
  const pm = /Output written on .*?\((\d+) pages?/.exec(log);
  return { diagnostics: out, pages: pm ? Number(pm[1]) : null };
}
