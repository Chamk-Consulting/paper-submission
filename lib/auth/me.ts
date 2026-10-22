import { cache } from "react";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readMyPerson } from "@/lib/auth/my-person";

export type Me = {
  userId: string;
  email: string;
  confirmedAt: string | null;
  person: {
    id: string;
    given_name: string;
    family_name: string;
    display_name: string;
    paper_name?: string | null;
    badge_name?: string | null;
    plenary_id?: string | null;
    orcid?: string | null;
    country?: string | null;
    name_scripts?: { script: string; name: string }[] | null;
    profile_completed_at?: string | null;
  } | null;
  affiliation: { institution: string; department: string | null; country: string | null } | null;
};

/** The signed-in person (RLS: only their own rows). `select("*")` so pending columns don't break reads. */
export const getMe = cache(async function getMe(): Promise<Me | null> {
  const supabase = await createClient();
  // the profile read and the sign-in check go out together (my_person works from the session token)
  const [{ data: auth }, early] = await Promise.all([supabase.auth.getUser(), supabase.rpc("my_person")]);
  if (!auth.user) return null;
  const person = (!early.error ? early.data : await readMyPerson(supabase, auth.user.id)) as Me["person"];
  let affiliation: Me["affiliation"] = null;
  if (person) {
    const { data: aff } = await supabase
      .from("affiliations")
      .select("institution, department, country, ends_on, created_at")
      .eq("person_id", person.id)
      .is("ends_on", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    affiliation = aff ? { institution: aff.institution, department: aff.department, country: aff.country } : null;
  }
  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    confirmedAt: auth.user.email_confirmed_at ?? null,
    person: (person as Me["person"]) ?? null,
    affiliation,
  };
});
