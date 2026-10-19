import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Badge } from "@/lib/attend/badge";

/* Read models for the attend slice: RG01 registration, BD01 badges, PP01 public paper page. */

export type Ticket = { index: number; name: string; covers: number; price_cents: number | null; early_cents: number | null; late_cents: number | null };
export type Extra = { index: number; name: string; price_cents: number | null };
export type MyPaperOption = { id: string; number: number; title: string; corresponding: boolean; presenter: string | null; covered_by: string | null };
export type MyRegistration = {
  id: string; number: string; reg_type: string; status: "confirmed" | "awaiting_payment" | "cancelled"; paid_at: string | null; amount_cents: number | null;
  currency: string | null; invoice_number: string | null; payment_method: string | null; items: { kind: string; name: string; qty: number; unit_cents: number }[];
  created_at: string; checked_in_at: string | null; papers: number[];
};
export type RegistrationOptions = {
  currency: string; early_until: string | null; is_early: boolean; papers_per_registration: number; tickets: Ticket[]; extras: Extra[];
  papers: MyPaperOption[]; mine: MyRegistration | null; me: { name: string | null; email: string | null; affiliation: string | null } | null;
};

export async function loadRegistrationOptions(venueId: string): Promise<RegistrationOptions | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registration_options", { p_venue: venueId });
  if (error || !data) return null;
  return data as RegistrationOptions;
}

export async function loadMyBadge(venueId: string): Promise<Badge | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_badge", { p_venue: venueId });
  return (data as Badge | null) ?? null;
}

export async function loadBadgeSheet(venueId: string): Promise<Badge[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("badge_sheet", { p_venue: venueId });
  return ((data ?? []) as Badge[]);
}

export type ProgramPaper = {
  id: string; number: number; title: string; abstract: string | null; keywords: string[]; paper_type: string | null;
  authors: { name: string; affiliation: string | null }[];
  talk: { session_id: string; code: string; session_title: string; kind: string; starts_at: string; session_starts_at: string; session_ends_at: string; talk_min: number;
    room: string | null; presenter: string | null; remote: boolean; has_slides: boolean };
  saved: boolean;
};

export async function loadProgramPaper(venueId: string, number: number): Promise<ProgramPaper | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("program_paper", { p_venue: venueId, p_number: number });
  return (data as ProgramPaper | null) ?? null;
}

export type RegistrationDoc = {
  id: string; number: string; invoice_number: string | null; reg_type: string; full_name: string | null; email: string | null; affiliation: string | null;
  status: string; paid_at: string | null; created_at: string; amount_cents: number | null; currency: string | null;
  items: { kind: string; name: string; qty: number; unit_cents: number }[]; billing: { name?: string; vat?: string; address?: string; po?: string; email?: string };
  payment_method: string | null; venue: string; venue_name: string; location: string | null; starts_on: string | null; ends_on: string | null;
  papers: { number: number; title: string }[];
};

export async function loadRegistrationDoc(id: string): Promise<RegistrationDoc | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("registration_document", { p_registration: id });
  return (data as RegistrationDoc | null) ?? null;
}
