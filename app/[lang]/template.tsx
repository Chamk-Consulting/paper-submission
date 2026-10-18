import { ViewTransition } from "react";

/**
 * Templates re-mount on every navigation (layouts don't), so the page content gets enter/exit
 * animations here: links tagged transitionTypes={["nav-forward"]} / ["nav-back"] slide; other
 * navigations rise-and-fade. Browser back/forward and refreshes don't animate.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
