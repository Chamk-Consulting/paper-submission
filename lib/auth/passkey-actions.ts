"use server";

import { createClient } from "@/lib/supabase/server";
import { recordSignIn } from "@/lib/auth/sign-in-log";

/** After a passkey sign-in in the browser: add it to the person's sign-in activity and remember the device. */
export async function notePasskeySignIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) await recordSignIn(supabase, "passkey");
}
