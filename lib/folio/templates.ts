/** Starter projects for a new Folio paper: the default folder structure (main.tex, preamble/, sections/, refs/, figures/). */

export type TemplateKey = "ieee-conference" | "article" | "blank";
export type TemplateFile = { path: string; content: string };
export type FolioTemplate = { key: TemplateKey; name: string; description: string; engine: "pdflatex" | "lualatex"; files: TemplateFile[] };

const PACKAGES = `% Packages used by this paper. Folio checks them against the event's rules.
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{siunitx}
\\usepackage{xcolor}
`;

const MACROS = `% Your own commands. Write them once, use them everywhere.
\\newcommand{\\R}{\\mathbb{R}}
\\newcommand{\\norm}[1]{\\left\\lVert#1\\right\\rVert}
\\newcommand{\\Hinf}{\\mathcal{H}_\\infty}
`;

const BIB = `@book{fossen2011,
  author    = {Fossen, Thor I.},
  title     = {Handbook of Marine Craft Hydrodynamics and Motion Control},
  publisher = {Wiley},
  year      = {2011}
}

@article{mayne2000,
  author  = {Mayne, David Q. and Rawlings, James B. and Rao, Christopher V. and Scokaert, Pierre O. M.},
  title   = {Constrained model predictive control: Stability and optimality},
  journal = {Automatica},
  volume  = {36},
  number  = {6},
  pages   = {789--814},
  year    = {2000},
  doi     = {10.1016/S0005-1098(99)00214-9}
}
`;

const INTRO = `\\section{Introduction}\\label{sec:intro}
Model predictive control (MPC) handles constraints explicitly~\\cite{mayne2000}.
For marine vessels, the dynamics are well described in~\\cite{fossen2011}.
This paper shows how Folio builds a paper: edit on the left, the PDF updates on the right.

Our contributions are:
\\begin{itemize}
  \\item a first contribution;
  \\item a second contribution.
\\end{itemize}
`;

const METHOD = `\\section{Method}\\label{sec:method}
We consider the system
\\begin{equation}
  \\dot{x} = A x + B u, \\qquad x \\in \\R^n,
  \\label{eq:system}
\\end{equation}
and bound the gain $\\norm{G}_{\\Hinf} \\le \\gamma$.
Section~\\ref{sec:results} reports the results.
`;

const RESULTS = `\\section{Results}\\label{sec:results}
Table~\\ref{tab:results} compares the controllers at a speed of \\qty{3.2}{m/s}.

\\begin{table}[t]
  \\centering
  \\caption{Tracking error by controller}
  \\label{tab:results}
  \\begin{tabular}{lrr}
    \\toprule
    Controller & RMS error (\\si{m}) & Time (\\si{ms}) \\\\
    \\midrule
    Nominal MPC & 0.42 & 3.1 \\\\
    Learning MPC & 0.18 & 4.7 \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}

\\section{Conclusion}
Write your conclusion here.
`;

export const TEMPLATES: FolioTemplate[] = [
  {
    key: "ieee-conference",
    name: "IEEE conference",
    description: "Two columns, IEEEtran class, numbered citations. Fits ECC, CDC, ACC and most IEEE events.",
    engine: "pdflatex",
    files: [
      {
        path: "main.tex",
        content: `\\documentclass[conference]{IEEEtran}
\\input{preamble/packages}
\\input{preamble/macros}

\\title{Your Paper Title}
\\author{\\IEEEauthorblockN{First Author}
\\IEEEauthorblockA{Your Institution\\\\ you@example.org}}

\\begin{document}
\\maketitle

\\begin{abstract}
One paragraph: the problem, what you did, the main result.
\\end{abstract}

\\begin{IEEEkeywords}
model predictive control, marine vessels
\\end{IEEEkeywords}

\\input{sections/introduction}
\\input{sections/method}
\\input{sections/results}

\\bibliographystyle{IEEEtran}
\\bibliography{refs/references}
\\end{document}
`,
      },
      { path: "preamble/packages.tex", content: PACKAGES },
      { path: "preamble/macros.tex", content: MACROS },
      { path: "sections/introduction.tex", content: INTRO },
      { path: "sections/method.tex", content: METHOD },
      { path: "sections/results.tex", content: RESULTS },
      { path: "refs/references.bib", content: BIB },
    ],
  },
  {
    key: "article",
    name: "Article",
    description: "One column, the standard article class. Good for preprints, reports and drafts.",
    engine: "pdflatex",
    files: [
      {
        path: "main.tex",
        content: `\\documentclass[11pt]{article}
\\usepackage[margin=2.5cm]{geometry}
\\input{preamble/packages}
\\input{preamble/macros}
\\usepackage[hidelinks]{hyperref}

\\title{Your Paper Title}
\\author{First Author}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
One paragraph: the problem, what you did, the main result.
\\end{abstract}

\\input{sections/introduction}
\\input{sections/method}
\\input{sections/results}

\\bibliographystyle{plain}
\\bibliography{refs/references}
\\end{document}
`,
      },
      { path: "preamble/packages.tex", content: PACKAGES },
      { path: "preamble/macros.tex", content: MACROS },
      { path: "sections/introduction.tex", content: INTRO },
      { path: "sections/method.tex", content: METHOD },
      { path: "sections/results.tex", content: RESULTS },
      { path: "refs/references.bib", content: BIB },
    ],
  },
  {
    key: "blank",
    name: "Blank",
    description: "A single main.tex. Start from nothing.",
    engine: "pdflatex",
    files: [
      {
        path: "main.tex",
        content: `\\documentclass{article}
\\begin{document}

Start writing here.

\\end{document}
`,
      },
    ],
  },
];

export const templateByKey = (k: string) => TEMPLATES.find((t) => t.key === k) ?? TEMPLATES[0];
