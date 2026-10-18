import { PageTransition } from "@/components/motion/page-transition";

/**
 * Templates re-mount when the segment below them changes; each one owns the transition of its level:
 * this one for top-level moves (landing ↔ venues ↔ workspace ↔ sign-in), and the templates in
 * venues/, workspace/, (auth)/ and submissions/[id]/ for moves inside those sections.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
