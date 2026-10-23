import { redirect } from "next/navigation";

/* /workspace/settings → its first page. */
export default function Page() {
  redirect("/workspace/settings/notifications");
}
