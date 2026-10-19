/* Shapes shared by the venue polish screens (PV01c, PV01p, PV02, EM10 venue-page card). */

export type MyTask = { id: string; category: "paper" | "review"; title: string; startsAt: string; detail: string | null; href: string | null };

export type MyVenueStatus = {
  roles: string[];
  papers: { id: string; number: number | null; title: string; stage: string; draft_step: number | null }[];
  reviews: { id: string; number: number | null; status: string; due_at: string }[];
};

export type Direction = { mode: "train" | "plane" | "bus" | "car" | "walk" | "other"; title: string; time?: string; note?: string };
export type Hotel = { name: string; meta?: string; price?: string };
export type GalleryPhoto = { path: string; caption?: string; credit?: string };

export type VenuePublicInfo = {
  attending?: {
    registration_note?: string; registration_url?: string; visa?: string; grants?: string;
    hotels_note?: string; keynotes?: string; conduct?: string; accessibility?: string;
  };
  travel?: { address?: string; summary?: string; directions?: Direction[]; hotels?: Hotel[]; hotel_code?: string; hotel_deadline?: string };
  gallery?: GalleryPhoto[];
};

export type Fee = { name: string; early: number | null; late: number | null; covers?: string };

export type VenuePublic = {
  info: VenuePublicInfo;
  fees: Fee[];
  currency: string;
  papersPerRegistration: number | null;
  lat: number | null;
  lng: number | null;
};

export type VenueArchive = {
  venueId: string; slug: string; name: string; acr: string; startsOn: string | null; endsOn: string | null; where: string | null;
  importedFrom: string | null; bestPaper: string | null;
  submitted: number | null; accepted: number | null; acceptanceRate: number | null; countries: number | null;
  papers: { number: number | null; title: string; type: string; authors: string | null }[];
  programPublished: boolean;
};

export type ArchiveSession = {
  session_id: string; code: string; title: string; kind: string; room: string | null; starts_at: string; ends_at: string;
  talks: { title: string; authors: string | null; presenter: string | null; number: number | null }[];
};

export type ArchiveAward = { award: string; title: string; authors: string | null };

/** Public URL of a gallery photo in the 'venue-media' bucket. */
export function mediaUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/venue-media/${path.split("/").map(encodeURIComponent).join("/")}`;
}
