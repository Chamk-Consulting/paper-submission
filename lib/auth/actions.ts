"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  // Only this device: signing out on a laptop shouldn’t end the session on a phone (Settings › Security has “Sign out of all other devices”).
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
