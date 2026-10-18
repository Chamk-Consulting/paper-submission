export type Field = "control" | "robotics" | "ocean" | "systems";
export type DateKind = "submission" | "proposal" | "notification" | "conference" | "final" | "registration" | "other";

export type VenueDate = {
  id: string;
  kind: DateKind;
  label: string;
  startsAt: string;       // ISO instant
  endsAt: string | null;
  isHard: boolean;
  isExtended: boolean;
  extendedFrom: string | null;
};

export type DirectoryVenue = {
  id: string;
  slug: string;
  acr: string;            // short_name or name
  name: string;
  kind: "conference" | "workshop" | "journal" | "award";
  society: string | null;
  field: Field | null;
  format: "in_person" | "hybrid" | "online" | null;
  reviewMode: string | null;
  pageLimit: string | null;
  indexedIn: string[];
  accepting: string | null;
  city: string | null;
  country: string | null;
  location: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  placeHint: string | null;
  startsOn: string | null;
  endsOn: string | null;
  papersCount: number | null;
  acceptanceRate: number | null;
  bestPaper: string | null;
  importedFrom: string | null;
  dates: VenueDate[];
};

export type VenueDetails = {
  cfp?: string;
  topics?: string[];
  types?: { name: string; note?: string; length?: string; review?: string }[];
  policies?: { title: string; text: string; tag?: string }[];
  publication?: { proceedings?: string; copyright?: string; journal?: string };
  organizers?: { role: string; name: string; org?: string; topic?: string }[];
  website?: string | null;
};

export const FIELD_LABEL: Record<Field, string> = { control: "Control", robotics: "Robotics", ocean: "Ocean engineering", systems: "Systems & decision" };
export const FIELD_COLOR: Record<Field, [string, string]> = { control: ["#E6EDFC", "#1F47A8"], robotics: ["#FBEFDD", "#7A4508"], ocean: ["#E1F3EA", "#14603F"], systems: ["#EEF0EC", "#4A5263"] };
export const FORMAT_LABEL = { in_person: "In person", hybrid: "Hybrid", online: "Online" } as const;
export const KIND_LABEL = { conference: "Conference", workshop: "Workshop", journal: "Journal", award: "Award" } as const;
