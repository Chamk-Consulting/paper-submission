import { notFound } from "next/navigation";

/** Unknown paths render the ER01 404 (app/[lang]/not-found.tsx) inside the localized layout. */
export default function CatchAll() {
  notFound();
}
