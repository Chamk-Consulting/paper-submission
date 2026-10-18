/** Motion tokens (mirrored as CSS variables in app/globals.css). */
export const DURATION = { out: 90, gap: 60, fast: 120, base: 200, slow: 280 } as const;
export const EASING = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  emphasized: "cubic-bezier(0.3, 0, 0, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
} as const;
/** View-transition class names used across the app (see globals.css). */
export const VT = {
  pageIn: "page-in", pageOut: "page-out",
  stepIn: "step-in", stepOut: "step-out",
  skeletonOut: "skeleton-out", contentIn: "content-in",
  chrome: "chrome", chromeSwap: "chrome-swap",
  cardIn: "card-in", cardOut: "card-out", cardMove: "card-move",
  panelIn: "panel-in", panelOut: "panel-out",
} as const;
