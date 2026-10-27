/* Sample data for the development-only preview pages (app/[lang]/(app)/dev-preview). Never used in production. */
import type { DirectoryVenue, VenueDate } from "@/lib/venues/types";
import type { MyEvents } from "@/lib/workspace/event-action";

const day = 86400000;
const iso = (d: number) => new Date(Date.now() + d * day).toISOString();
const date = (d: string) => new Date(Date.now() + Number(d) * day).toISOString().slice(0, 10);
const dl = (id: string, kind: VenueDate["kind"], label: string, inDays: number): VenueDate => ({ id, kind, label, startsAt: iso(inDays), endsAt: null, isHard: true, isExtended: false, extendedFrom: null });

function venue(i: number, acr: string, name: string, over: Partial<DirectoryVenue>): DirectoryVenue {
  return {
    id: `v${i}`, slug: acr.toLowerCase().replace(/[^a-z0-9]+/g, "-"), acr, name, kind: "conference", society: "IEEE CSS", field: "control",
    format: "in_person", reviewMode: "Single-blind", pageLimit: "6+2 pages", indexedIn: ["IEEE Xplore", "Scopus"], accepting: "Regular papers, invited sessions",
    city: "Lisbon", country: "Portugal", location: null, region: "Europe", lat: 38.7, lng: -9.1, placeHint: null,
    startsOn: date("120"), endsOn: date("123"), papersCount: null, acceptanceRate: null, bestPaper: null, importedFrom: null,
    dates: [dl(`d${i}a`, "submission", "Full paper", 12), dl(`d${i}b`, "notification", "Notification", 60)], cover: null, ...over,
  };
}

export const PREVIEW_VENUES: DirectoryVenue[] = [
  venue(1, "PDC 2027", "Plenary Demo Conference on Decision and Control", { dates: [dl("a", "submission", "Full paper", 5)] }),
  venue(2, "PDJ", "Plenary Demo Journal of Systems", { kind: "journal", society: null, field: "systems", city: null, country: null, format: "online", dates: [], startsOn: null, endsOn: null }),
  venue(3, "ROBO 2027", "International Symposium on Field Robotics", { field: "robotics", society: "IFAC", city: "Kyoto", country: "Japan", region: "Asia–Pacific", dates: [dl("b", "submission", "Full paper", 40)] }),
  venue(4, "OCEANS 2027", "Ocean Engineering Conference", { field: "ocean", society: "MTS", city: "Halifax", country: "Canada", region: "Americas", format: "hybrid", dates: [dl("c", "submission", "Abstract", 90)] }),
  venue(5, "QATC 2027", "QA Test Conference with a much longer name that wraps on phones", { field: "control", dates: [dl("d", "submission", "Full paper", 25)] }),
];

export const PREVIEW_MINE: MyEvents = {
  "pdc-2027": { roles: ["owner", "program_chair", "reviewer"], following: true, papers: [
    { id: "p1", href: "/submissions/p1/details", title: "Adaptive control for marine robots", number: null, stage: "draft", detail: "Step 2 of 7" },
    { id: "p2", href: "/submissions/p2", title: "Robust MPC under delays", number: 1042, stage: "review", detail: "" },
  ] },
  pdj: { roles: ["reviewer", "chair"], following: false, papers: [{ id: "p3", href: "/submissions/p3", title: "A survey of event-triggered control", number: 77, stage: "revise", detail: "" }] },
  "qatc-2027": { roles: ["owner"], following: true, papers: [] },
};

export const PREVIEW_SUMMARY = {
  signedIn: true, name: "Quinn Tester", initials: "QT", plenaryId: "1042", unread: 3, submissionCount: 29, isAdmin: true, organizerOf: "pdc-2027",
  venues: [
    { slug: "pdc-2027", name: "Plenary Demo Conference 2027", shortName: "PDC 2027", roles: ["reviewer", "session_chair", "owner", "program_chair"] },
    { slug: "pdj", name: "Plenary Demo Journal", shortName: "PDJ", roles: ["reviewer", "chair"] },
    { slug: "qatc-2027", name: "QA Test Conference 2027", shortName: "QATC 2027", roles: ["owner", "program_chair"] },
  ],
  following: [{ slug: "pdc-2027", name: "Plenary Demo Conference 2027", shortName: "PDC 2027" }, { slug: "qatc-2027", name: "QA Test Conference 2027", shortName: "QATC 2027" }],
};

export const PREVIEW_EVENT = {
  venue: { ...PREVIEW_VENUES[0], dates: [
    dl("e1", "submission", "Full paper", 5), dl("e2", "notification", "Notification", 60), dl("e3", "final", "Final version", 80), dl("e4", "conference", "Conference", 120),
  ] },
  details: {
    cfp: "PDC 2027 invites original research on decision and control: theory, computation and applications.\nInvited sessions and tutorials are welcome.",
    topics: ["Adaptive control", "Optimization", "Robotics", "Networked systems", "Learning-based control"],
    types: [{ name: "Regular paper", length: "6 + 2 pages", review: "Single-blind, 3 reviews" }, { name: "Invited session proposal", length: "2 pages", review: "Chairs" }],
    policies: [{ title: "Generative AI", text: "Disclose any AI tools used to write the paper.", tag: "NEW" }, { title: "Double submission", text: "The paper must not be under review elsewhere." }],
    publication: { proceedings: "IEEE Xplore", copyright: "IEEE eCF after acceptance" },
    organizers: [{ role: "General chair", name: "Ada Lovelace", org: "University of Lisbon" }, { role: "Program chair", name: "Quinn Tester", org: "Plenary" }],
  },
  doubleBlind: false, website: "https://example.org/pdc2027",
  basics: { tagline: "Control for a changing world", publicText: null, venueAddress: null, hotels: null },
  dbTypes: [],
};
