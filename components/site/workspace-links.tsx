"use client";

import { createContext, useContext, type ReactNode } from "react";
import { workspaceFor } from "@/lib/site/workspace-routes";

/* Inside the workspace frame, links to public pages point at their workspace versions (Find events, the event page,
   Help, Support, Legal), so a signed-in person never takes a detour through a redirect. The public site is unchanged. */
const Ctx = createContext(false);

export function WorkspaceLinks({ children }: { children: ReactNode }) {
  return <Ctx.Provider value>{children}</Ctx.Provider>;
}

export function useWorkspaceHref(href: unknown): unknown {
  const on = useContext(Ctx);
  if (!on || typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) return href;
  const cut = href.search(/[?#]/);
  const path = cut < 0 ? href : href.slice(0, cut);
  const rest = cut < 0 ? "" : href.slice(cut);
  const to = workspaceFor(path);
  return to ? to + rest : href;
}
