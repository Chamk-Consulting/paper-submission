import { redirect } from "next/navigation";

/* /workspace/account → its first page. */
export default function Page() {
  redirect("/workspace/account/profile");
}
