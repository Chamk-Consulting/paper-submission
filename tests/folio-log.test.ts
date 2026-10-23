import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLatexLog } from "../lib/folio/log.ts";

const LOG = `This is pdfTeX
(./main.tex
./sections/method.tex:12: Undefined control sequence.
l.12 \\badcommand
               
LaTeX Warning: Reference \`sec:missing' on page 1 undefined on input line 7.

LaTeX Warning: Citation \`nobody2020' on page 1 undefined on input line 9.

Overfull \\hbox (12.5pt too wide) in paragraph at lines 20--22
Underfull \\hbox (badness 1200) in paragraph at lines 30--31
Package siunitx Warning: Something odd
(siunitx)                on input line 40.
Output written on main.pdf (3 pages, 120000 bytes).
`;

test("errors keep their file and line", () => {
  const { diagnostics, pages } = parseLatexLog(LOG);
  assert.equal(pages, 3);
  const err = diagnostics.find((d) => d.kind === "error");
  assert.deepEqual([err?.file, err?.line], ["sections/method.tex", 12]);
});

test("references, citations and boxes", () => {
  const { diagnostics } = parseLatexLog(LOG);
  assert.ok(diagnostics.some((d) => d.kind === "undefined-ref" && d.line === 7 && d.file === "main.tex"));
  assert.ok(diagnostics.some((d) => d.kind === "undefined-cite" && d.message.includes("nobody2020")));
  assert.ok(diagnostics.some((d) => d.kind === "overfull" && d.line === 20));
  assert.ok(!diagnostics.some((d) => d.kind === "underfull"), "mild underfull boxes are skipped");
  const pkg = diagnostics.find((d) => d.message.startsWith("siunitx"));
  assert.equal(pkg?.line, 40);
});
