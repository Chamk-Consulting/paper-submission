import { StepTransition } from "@/components/motion/step-transition";

/** Wizard steps slide left/right in the direction of travel; header, title band and step rail stay put. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <StepTransition>{children}</StepTransition>;
}
