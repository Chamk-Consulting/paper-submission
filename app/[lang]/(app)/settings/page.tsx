import { redirect } from "next/navigation";

/* /settings → the first settings page. */
export default function Page() {
  redirect("/settings/profile");
}
