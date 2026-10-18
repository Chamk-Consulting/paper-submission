import { ManageSkeleton } from "@/components/skeletons";

/* Skeletons for the setup1 slice (EM02, EM04, EM05, EM07, EM13). The shared organizer skeleton already draws
   the shell, head and cards; a table screen gets more rows so the layout doesn't jump. */
export function Setup1Skeleton({ table = false, rows }: { table?: boolean; rows?: number }) {
  return <ManageSkeleton rows={rows ?? (table ? 4 : 3)} />;
}
