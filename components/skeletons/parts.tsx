import type { CSSProperties, ReactNode } from "react";
import { LoadingLabel } from "@/components/skeletons/label";

/** One shimmering placeholder line/box. All bars share one light sweep (see .sk in globals.css). */
export const Bar = ({ w = "100%", h = 14, className = "", dark = false, style }: { w?: number | string; h?: number; className?: string; dark?: boolean; style?: CSSProperties }) => (
  <span aria-hidden className={`block ${dark ? "sk-dark" : "sk"} ${className}`} style={{ width: w, height: h, ...style }} />
);

/** Marks a region as loading for assistive tech; the visual handoff is done by <Reveal>. */
export function Skeleton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div aria-busy="true" className={className}>
      <LoadingLabel />
      {children}
    </div>
  );
}

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-[8px] border border-[#DADDE3] bg-white p-5 ${className}`}>{children}</div>
);

/** A text line placeholder whose height matches the line box of real text at that size. */
export const Line = ({ size = 15, lh = 1.5, w = "100%", className = "", dark = false }: { size?: number; lh?: number; w?: number | string; className?: string; dark?: boolean }) => (
  <span aria-hidden className={`flex items-center ${className}`} style={{ height: Math.round(size * lh), width: w }}>
    <span className={`block w-full ${dark ? "sk-dark" : "sk"}`} style={{ height: Math.round(size * 0.78) }} />
  </span>
);
