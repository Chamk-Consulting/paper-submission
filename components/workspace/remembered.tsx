"use client";

import type { ReactNode } from "react";
import { AccountMenu } from "@/components/workspace/account-menu";

/*
 * The workspace header and side menu are drawn by each page. While a page loads, its skeleton draws the
 * same chrome without data (ctx = null). These pieces remember the last real values in this browser tab,
 * so the avatar, unread badge, counts and venue lists stay put across clicks instead of flickering.
 */
const last = new Map<string, unknown>();

function keep<V>(id: string, value: V | undefined): V | undefined {
  if (value !== undefined) last.set(id, value);
  return (value !== undefined ? value : last.get(id)) as V | undefined;
}

/** A small number badge. `value` undefined = still loading (show the last known number). */
export function Count({ id, value, className, cap }: { id: string; value: number | undefined; className: string; cap?: number }) {
  const n = keep(id, value);
  if (!n) return null;
  return <span aria-hidden className={className}>{cap && n > cap ? `${cap}+` : n}</span>;
}

export function Account({ data }: { data: { name: string; initials: string; plenaryId: string | null } | null }) {
  const d = keep("account", data ?? undefined);
  return d ? <AccountMenu name={d.name} initials={d.initials} plenaryId={d.plenaryId} /> : <span aria-hidden className="sk-dark block size-10 rounded-full!" />;
}

/** A server-rendered block that depends on data: shown as last rendered while the next page loads. */
export function Block({ id, ready, children }: { id: string; ready: boolean; children: ReactNode }) {
  const b = keep<ReactNode>(id, ready ? children : undefined);
  return <>{b ?? null}</>;
}
