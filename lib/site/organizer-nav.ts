/** Organizer links of the event sidebar (canvas EM20–EM44). key → path under /manage/[slug]. */
export const ORGANIZER_NAV: [string, string, string][] = [
  ["dashboard", "Event dashboard", ""], ["papers", "Papers", "/papers"], ["similarity", "Similarity check", "/similarity"], ["assignment", "Assignment", "/assignment"],
  ["reviews", "Review progress", "/reviews"], ["decisions", "Decisions", "/decisions"], ["awards", "Awards", "/awards"], ["finals", "Final versions", "/finals"],
  ["program", "Program builder", "/program"], ["registrations", "Registrations", "/registrations"], ["live", "Event day", "/live"], ["checkin", "Badges & check-in", "/checkin"],
  ["proceedings", "Proceedings & reports", "/proceedings"],
  ["people", "People", "/people"], ["email", "Email center", "/email"], ["setup", "Setup", "/setup"], ["payments", "Payments", "/payments"], ["invoices", "Invoices", "/invoices"], ["billing", "Billing", "/billing"],
  ["committee", "Committee", "/setup/committee"], ["roles", "My roles & conflicts", "@/manage/roles"], ["audit", "Audit log", "/audit"],
];
/** Organizer items only the event owner sees. */
export const OWNER_ONLY = new Set(["billing"]);

/** The organiser links in folding groups for the side menu: [group key, group label, organiser keys]. */
export const ORGANIZER_GROUPS: [string, string, string[]][] = [
  ["overview", "Overview", ["dashboard"]],
  ["submissions", "Submissions", ["papers", "similarity"]],
  ["reviewing", "Reviewing", ["assignment", "reviews", "decisions", "awards"]],
  ["after", "After acceptance", ["finals", "proceedings"]],
  ["event", "Event", ["program", "registrations", "live", "checkin"]],
  ["team", "Team & email", ["people", "committee", "email"]],
  ["settings", "Event settings", ["setup", "payments", "invoices", "billing", "roles", "audit"]],
];
