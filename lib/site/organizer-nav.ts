/** Organizer links of the event sidebar (canvas EM20–EM44). key → path under /manage/[slug]. */
export const ORGANIZER_NAV: [string, string, string][] = [
  ["dashboard", "Event dashboard", ""], ["papers", "Papers", "/papers"], ["similarity", "Similarity check", "/similarity"], ["assignment", "Assignment", "/assignment"],
  ["reviews", "Review progress", "/reviews"], ["decisions", "Decisions", "/decisions"], ["awards", "Awards", "/awards"], ["finals", "Final versions", "/finals"],
  ["program", "Program builder", "/program"], ["registrations", "Registrations", "/registrations"], ["live", "Event day", "/live"], ["checkin", "Badges & check-in", "/checkin"],
  ["proceedings", "Proceedings & reports", "/proceedings"],
  ["people", "People", "/people"], ["email", "Email centre", "/email"], ["setup", "Setup", "/setup"], ["billing", "Billing", "/billing"],
  ["committee", "Committee", "/setup/committee"], ["roles", "My roles & conflicts", "@/manage/roles"], ["audit", "Audit log", "/audit"],
];
/** Organizer items only the event owner sees. */
export const OWNER_ONLY = new Set(["billing"]);
