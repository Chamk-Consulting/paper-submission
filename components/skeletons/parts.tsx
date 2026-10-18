import { ViewTransition, type CSSProperties } from "react";
import { LoadingLabel } from "@/components/skeletons/label";

export const Bar = ({ w = "100%", h = 14, className = "", dark = false, style }: { w?: number | string; h?: number; className?: string; dark?: boolean; style?: CSSProperties }) => (
  <span aria-hidden className={`block ${dark ? "sk-dark" : "sk"} ${className}`} style={{ width: w, height: h, ...style }} />
);

/** Wraps a skeleton: announced to screen readers, fades out when the real content arrives. */
export function Skeleton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <ViewTransition exit="skeleton-out" default="none">
      <div aria-busy="true" className={className}>
        <LoadingLabel />
        {children}
      </div>
    </ViewTransition>
  );
}

export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-[8px] border border-[#DADDE3] bg-white p-5 ${className}`}>{children}</div>
);
