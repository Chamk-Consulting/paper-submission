"use client";

import type { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import { snippetCompletion } from "@codemirror/autocomplete";

/**
 * LaTeX completion for the source editor, all local (no AI, no network):
 * commands and environments, \ref/\eqref/\cref labels from every file of the paper,
 * \cite keys from the paper's .bib files, and project paths for \input / \includegraphics.
 */

export type ProjectIndex = { labels: { key: string; file: string }[]; cites: { key: string; title: string }[]; paths: string[]; macros: string[] };

const CMDS: [string, string?][] = [
  ["section{${}}", "Section"], ["subsection{${}}", "Subsection"], ["subsubsection{${}}", "Subsubsection"], ["paragraph{${}}", "Paragraph"],
  ["label{${}}", "Label"], ["ref{${}}", "Reference"], ["eqref{${}}", "Equation reference"], ["cref{${}}", "Clever reference"],
  ["cite{${}}", "Citation"], ["citep{${}}", "Citation (natbib)"], ["citet{${}}", "Citation in text (natbib)"],
  ["textbf{${}}", "Bold"], ["textit{${}}", "Italic"], ["emph{${}}", "Emphasis"], ["texttt{${}}", "Monospace"], ["underline{${}}", "Underline"],
  ["footnote{${}}", "Footnote"], ["url{${}}", "URL"], ["href{${url}}{${text}}", "Link"],
  ["includegraphics[width=\\linewidth]{${}}", "Image"], ["input{${}}", "Include a file"], ["include{${}}", "Include a chapter"],
  ["caption{${}}", "Caption"], ["centering"], ["item ${}", "List item"], ["frac{${}}{${}}", "Fraction"], ["sqrt{${}}", "Square root"],
  ["mathbb{${}}", "Blackboard bold"], ["mathcal{${}}", "Calligraphic"], ["mathbf{${}}", "Bold maths"], ["mathrm{${}}", "Upright maths"],
  ["left( ${} \\right)", "Brackets that grow"], ["qty{${3.2}}{${m/s}}", "Quantity (siunitx)"], ["num{${}}", "Number (siunitx)"], ["si{${}}", "Unit (siunitx)"],
  ["toprule"], ["midrule"], ["bottomrule"], ["hline"], ["newline"], ["noindent"], ["clearpage"], ["newpage"], ["maketitle"],
  ["tableofcontents"], ["bibliography{${refs/references}}", "Bibliography file"], ["bibliographystyle{${IEEEtran}}", "Bibliography style"],
  ["usepackage{${}}", "Package"], ["newcommand{\\${name}}{${}}", "New command"], ["renewcommand{\\${name}}{${}}", "Change a command"],
  ["documentclass{${article}}", "Document class"], ["title{${}}", "Title"], ["author{${}}", "Author"], ["date{${}}", "Date"], ["today"],
  ["alpha"], ["beta"], ["gamma"], ["delta"], ["epsilon"], ["varepsilon"], ["theta"], ["lambda"], ["mu"], ["sigma"], ["tau"], ["phi"], ["varphi"], ["omega"],
  ["Gamma"], ["Delta"], ["Theta"], ["Lambda"], ["Sigma"], ["Phi"], ["Omega"], ["infty"], ["partial"], ["nabla"], ["sum_{${}}^{${}}"], ["int_{${}}^{${}}"],
  ["leq"], ["geq"], ["neq"], ["approx"], ["sim"], ["to"], ["rightarrow"], ["Rightarrow"], ["in"], ["subset"], ["cdot"], ["times"], ["pm"], ["ldots"], ["dots"],
];

const ENVS = ["equation", "align", "align*", "equation*", "gather", "multline", "figure", "figure*", "table", "table*", "tabular", "itemize", "enumerate", "description",
  "abstract", "theorem", "lemma", "proof", "definition", "remark", "corollary", "proposition", "algorithm", "algorithmic", "minipage", "center", "quote", "verbatim",
  "IEEEkeywords", "cases", "matrix", "bmatrix", "pmatrix", "array", "tikzpicture", "axis", "subfigure"];

const envSnippet = (env: string): string => {
  const body = env.startsWith("figure") ? "\t\\centering\n\t\\includegraphics[width=\\linewidth]{${file}}\n\t\\caption{${caption}}\n\t\\label{fig:${label}}"
    : env.startsWith("table") ? "\t\\centering\n\t\\caption{${caption}}\n\t\\label{tab:${label}}\n\t\\begin{tabular}{${lr}}\n\t\t\\toprule\n\t\t${} \\\\\n\t\t\\bottomrule\n\t\\end{tabular}"
    : env === "tabular" ? "\t${} \\\\"
    : env === "itemize" || env === "enumerate" ? "\t\\item ${}"
    : env.startsWith("equation") || env.startsWith("align") ? "\t${}" + (env.endsWith("*") ? "" : "\n\t\\label{eq:${label}}")
    : "\t${}";
  const arg = env === "tabular" ? "{${lr}}" : env === "figure" || env === "table" ? "[t]" : "";
  return `begin{${env}}${arg}\n${body}\n\\end{${env}}`;
};

export function latexCompletion(getIndex: () => ProjectIndex) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const before = line.text.slice(0, ctx.pos - line.from);

    // Inside a reference/citation/path argument: \ref{fig:a|, \cite{a, b|, \input{sec|
    const arg = /\\([A-Za-z]+\*?)(?:\[[^\]]*\])?\{([^{}]*)$/.exec(before);
    if (arg) {
      const cmd = arg[1];
      const typed = arg[2].split(",").pop() ?? "";
      const from = ctx.pos - typed.trimStart().length;
      const idx = getIndex();
      let options: Completion[] = [];
      if (/^(ref|eqref|cref|Cref|autoref|pageref|nameref|vref)$/.test(cmd)) {
        options = idx.labels.map((l) => ({ label: l.key, detail: l.file, type: "variable" }));
      } else if (/^(cite|citep|citet|citeauthor|citeyear|parencite|textcite|autocite|nocite)$/.test(cmd)) {
        options = idx.cites.map((c) => ({ label: c.key, detail: c.title.slice(0, 60), type: "constant" }));
      } else if (/^(input|include|subfile)$/.test(cmd)) {
        options = idx.paths.filter((p) => p.endsWith(".tex")).map((p) => ({ label: p.replace(/\.tex$/, ""), type: "text" }));
      } else if (cmd === "includegraphics") {
        options = idx.paths.filter((p) => /\.(pdf|png|jpe?g|eps|svg)$/i.test(p)).map((p) => ({ label: p, type: "text" }));
      } else if (/^(bibliography|addbibresource)$/.test(cmd)) {
        options = idx.paths.filter((p) => p.endsWith(".bib")).map((p) => ({ label: cmd === "bibliography" ? p.replace(/\.bib$/, "") : p, type: "text" }));
      } else if (/^(begin|end)$/.test(cmd)) {
        options = ENVS.map((e) => ({ label: e, type: "type" }));
      } else return null;
      return { from, options, validFor: /^[^,}\s]*$/ };
    }

    const word = ctx.matchBefore(/\\[A-Za-z]*$/);
    if (!word || (word.from === word.to && !ctx.explicit)) return null;
    const idx = getIndex();
    const options: Completion[] = [
      ...CMDS.map(([snip, detail]) => {
        const name = snip.replace(/[{[(\s$].*$/, "");
        return snippetCompletion(`\\${snip}`, { label: `\\${name}`, detail, type: "keyword" });
      }),
      ...ENVS.map((e) => snippetCompletion(`\\${envSnippet(e)}`, { label: `\\begin{${e}}`, detail: "Environment", type: "type", boost: -1 })),
      ...idx.macros.map((m) => ({ label: `\\${m}`, detail: "Your macro", type: "function", boost: 2 })),
    ];
    return { from: word.from, options, validFor: /^\\[A-Za-z]*$/ };
  };
}

/** Labels, cite keys, macros and paths found in the paper's files. */
export function buildIndex(files: { path: string; text: string | null }[]): ProjectIndex {
  const labels: ProjectIndex["labels"] = [];
  const cites: ProjectIndex["cites"] = [];
  const macros = new Set<string>();
  for (const f of files) {
    if (f.text == null) continue;
    if (f.path.endsWith(".bib")) {
      for (const m of f.text.matchAll(/@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)(?=\n@|\s*$)/g)) {
        if (/^(comment|string|preamble)$/i.test(m[1])) continue;
        const title = /title\s*=\s*[{"]([^}"]*)/i.exec(m[3])?.[1] ?? "";
        cites.push({ key: m[2], title });
      }
    } else {
      for (const m of f.text.matchAll(/\\label\{([^}]+)\}/g)) labels.push({ key: m[1], file: f.path });
      for (const m of f.text.matchAll(/\\(?:re)?newcommand\*?\{?\\([A-Za-z]+)\}?/g)) macros.add(m[1]);
      for (const m of f.text.matchAll(/\\DeclareMathOperator\*?\{?\\([A-Za-z]+)\}?/g)) macros.add(m[1]);
    }
  }
  return { labels, cites, paths: files.map((f) => f.path), macros: [...macros] };
}
