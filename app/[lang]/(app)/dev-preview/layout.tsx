import { notFound } from "next/navigation";

/** Development-only design previews with sample data (no database). Off unless PLENARY_PREVIEW=1 is set. */
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.PLENARY_PREVIEW !== "1") notFound();
  return children;
}
