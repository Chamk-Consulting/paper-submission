"use client";

import { useEffect, useSyncExternalStore } from "react";

/* An organiser page can tell the side menu the event's name and the person's role (e.g. a platform admin
   looking at an event they don't belong to, which isn't in their own venue list). */
type Hint = { slug: string; name: string; roleLabel: string } | null;
let hint: Hint = null;
const subs = new Set<() => void>();
const set = (h: Hint) => { hint = h; subs.forEach((f) => f()); };

export function useEventHint(): Hint {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => hint, () => null);
}

export function EventHint({ value }: { value: Hint }) {
  const key = value ? `${value.slug}|${value.name}|${value.roleLabel}` : "";
  useEffect(() => {
    if (!value) return;
    if (!hint || `${hint.slug}|${hint.name}|${hint.roleLabel}` !== key) set(value);
  }, [key, value]);
  return null;
}
