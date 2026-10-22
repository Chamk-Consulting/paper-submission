import type { ReactNode } from "react";

type T = (key: string, vars?: Record<string, string | number>) => string;
type StepState = "done" | "current" | "next";

/**
 * The 4 sign-up steps shown in the right-hand panel (one list for every screen, so the count never drifts).
 * `current` is 1–4; `texts` overrides the line under a step (e.g. the email, or "Confirmed 14:02 UTC").
 */
export function signupSteps(t: T, current: 1 | 2 | 3 | 4, texts: Partial<Record<1 | 2 | 3 | 4, ReactNode>> = {}) {
  const base: { title: string; text: ReactNode }[] = [
    { title: t("Your name and email"), text: t("So co-authors and chairs can find you.") },
    { title: t("Confirm your email"), text: t("A code by email, valid for 15 minutes.") },
    { title: t("Choose a password"), text: t("Only after the code, so only you can set it.") },
    { title: t("Your research profile"), text: t("Name on papers and affiliation — then you get your Plenary ID.") },
  ];
  return base.map((s, i) => {
    const n = (i + 1) as 1 | 2 | 3 | 4;
    const state: StepState = n < current ? "done" : n === current ? "current" : "next";
    return { title: s.title, text: texts[n] ?? s.text, state };
  });
}
