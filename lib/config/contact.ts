/*
 * Contact details shown on /contact, /help and the system pages.
 * PLACEHOLDERS — every value in [brackets] must be replaced before launch.
 * Team inbox for the contact form is the CONTACT_TO env var (set in Vercel, never here).
 */
export const contact = {
  replyTime: "[1 working day]",
  languages: "English, French, Italian or German",
  supportEmail: "[support email]",
  salesEmail: "[sales email]",
  securityEmail: "[security email]",
  privacyEmail: "[privacy email]",
  noReplyEmail: "no-reply@plenary.example",
  company: {
    legalName: "[Company legal name]",
    address: "[Postal address]",
    registration: "[Company registration number]",
  },
} as const;

/** CT01 support topics: id, label, hint. */
export const CONTACT_TOPICS = [
  ["signin", "Signing in", "Include the email or Plenary ID you sign in with. Never the code itself."],
  ["submit", "Submitting a paper", "Add the paper number (#1234) if you have one, and the step where it went wrong."],
  ["review", "Reviewing", "Tell us the venue. We can’t reveal or change review content — the chairs can."],
  ["event", "Running an event", "Chairs and society staff: name the event and your role."],
  ["billing", "Billing & invoices", "Add the invoice number or the event the invoice is for."],
  ["other", "Something else", "Anything — accessibility, a translation, an idea."],
] as const;

export const SALES_KINDS = [["conference", "Conference"], ["workshop", "Workshop"], ["journal", "Journal"], ["award", "Award or prize"]] as const;
export const SALES_ROLES = ["General or program chair", "Society staff", "Journal editor", "Award committee", "Something else"] as const;
export const SALES_SIZES = ["Fewer than 100", "100 – 500", "500 – 2,000", "More than 2,000"] as const;
export const SALES_SYSTEMS = ["PaperCept", "EasyChair", "OpenReview", "Microsoft CMT", "Another system", "Nothing yet"] as const;
