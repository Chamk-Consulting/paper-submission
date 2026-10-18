// Shared by server and client code (no server-only imports here).
export const STEPS = [
  { n: 1, key: "type", label: "Venue & type" },
  { n: 2, key: "details", label: "Details" },
  { n: 3, key: "authors", label: "Authors" },
  { n: 4, key: "keywords", label: "Keywords" },
  { n: 5, key: "files", label: "Upload PDF" },
  { n: 6, key: "conflicts", label: "Conflicts" },
  { n: 7, key: "review", label: "Review & submit" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

export const DEFAULT_TRACKS = ["Control theory and design", "Robotics and autonomous systems", "Optimisation and learning", "Networked and multi-agent systems", "Applications: energy, transport, biomedical"];

export const DEFAULT_KEYWORDS = [
  { group: "Control design", keywords: ["Adaptive control", "Robust control", "Nonlinear control", "Model predictive control", "Optimal control", "Backstepping"] },
  { group: "Systems", keywords: ["Marine systems", "Autonomous vehicles", "Networked systems", "Power systems", "Biomedical systems", "Robotic manipulators"] },
  { group: "Methods", keywords: ["Estimation and filtering", "Lyapunov methods", "Learning-based control", "Optimisation", "Identification", "Multi-agent systems"] },
];
