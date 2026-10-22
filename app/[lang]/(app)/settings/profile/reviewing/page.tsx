import { redirect } from "next/navigation";

/* Reviewing moved out of Profile into its own Account page; old links land there. */
export default function Page() {
  redirect("/settings/reviewing");
}
