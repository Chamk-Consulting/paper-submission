/* HP01 · Reviewer guides. English source text; translated through the dictionary (authpolish module).
   Every rule here matches what the review screens and database enforce (supabase/migrations/*_review*.sql). */

export type GuideSection = { h: string; p?: string[]; list?: string[] };
export type Guide = { slug: string; title: string; lead: string; minutes: number; sections: GuideSection[]; next?: { href: string; label: string } };

export const REVIEWER_GUIDES: Guide[] = [
  {
    slug: "workflow",
    title: "From invitation to decision",
    lead: "What happens to a review on Plenary, step by step, and what you can change at each point.",
    minutes: 4,
    sections: [
      { h: "1. The invitation", p: ["The email opens the invitation with one click — you don't need to sign in to accept or decline. You see the title and abstract, never the authors in a double-blind venue.", "To accept, confirm you have no conflict of interest and agree to the reviewing rules. Declining takes a reason and, if you like, the name of someone better placed."] },
      { h: "2. Reading the paper", p: ["Open the paper in the reviewer viewer: the anonymous PDF sits next to your review, so you can write while you read. Don't share the paper or use its ideas before it is published."] },
      { h: "3. Writing the review", list: ["Score every criterion from 1 (poor) to 5 (excellent).", "Say how confident you are and give a recommendation.", "Comments to the authors need at least 100 words: summary, strengths, weaknesses and the specific changes you'd ask for.", "Confidential comments go only to the editor and chairs — authors never see them.", "Your draft saves as you type; if you go offline, keep the tab open and it saves when you're back."] },
      { h: "4. After you submit", p: ["You get a receipt, and you can choose to add the review to your ORCID record — without naming the paper. You can still edit until the editor starts the decision; every change after submitting is logged and shown to the editor.", "Once your own review is in, you can read the other submitted reviews of the same paper and join the discussion if the venue uses one."] },
      { h: "5. The decision", p: ["The editor recommends and the chairs decide. When the decision is released you see it with all reviews and how your scores compare. If the venue runs a second round, you check each of your comments against the revised paper."] },
    ],
    next: { href: "/workspace/reviews", label: "Open my reviews" },
  },
  {
    slug: "blind-review",
    title: "Blind review: what stays hidden",
    lead: "Who sees what depends on the venue's review type. Plenary enforces it — these are the rules behind the screens.",
    minutes: 3,
    sections: [
      { h: "Double-blind (most venues)", list: ["You don't see the authors, and they never see you.", "Don't search for the paper online or try to identify the authors. If you recognise the work anyway, tell the editor in the confidential comments.", "Don't put your name, your own papers or anything identifying in your comments."] },
      { h: "Single-blind and open review", p: ["In single-blind venues you see the authors, but they don't see you. In open review both sides are named. The invitation tells you which one applies."] },
      { h: "Other reviewers", p: ["You see the other reviews of a paper only after submitting your own. They're labelled Reviewer 1, Reviewer 2… — names are shown only if the venue chose named discussions. Another reviewer's confidential comments are never shown to you."] },
      { h: "What authors see", p: ["After the decision is released, authors see your scores, recommendation and comments to the authors. They never see your name, your confidence or your confidential comments."] },
    ],
    next: { href: "/help/reviewers/conflicts", label: "Conflicts of interest" },
  },
  {
    slug: "ai-tools",
    title: "Using the AI panel responsibly",
    lead: "Each venue decides whether AI tools may be used on papers under review. Plenary shows you the rule and enforces it.",
    minutes: 3,
    sections: [
      { h: "The three venue policies", list: ["Language only — AI may help you polish your wording, but the assessment must be yours.", "Allowed with a declaration — you may use AI tools, and you say how in the confidential comments.", "Not allowed — the AI panel is switched off for this venue's papers. Don't paste the paper into other AI tools either."] },
      { h: "What the panel does", p: ["The viewer's panel can summarise the paper or answer a question about it, citing pages. To answer, the paper's text is sent to Plenary's AI provider for that request only. Requests are limited per hour."] },
      { h: "Good practice", list: ["Use summaries to orient yourself, never instead of reading.", "Check every answer against the page it cites before relying on it.", "Never paste AI-written text into your review as your own judgement.", "Confidential material stays confidential: no other tools, no sharing."] },
    ],
    next: { href: "/help/reviewers/workflow", label: "From invitation to decision" },
  },
  {
    slug: "extensions",
    title: "More time, or handing a review back",
    lead: "Things happen. Asking early helps the editor plan; going silent delays the authors' decision.",
    minutes: 2,
    sections: [
      { h: "Asking for more time", list: ["3 days: approved straight away, and your due date moves at once.", "7 or 14 days: the editor decides. They can approve, decline, or offer a different date, which you can accept with one click.", "Say why in a sentence — for example travel or a deadline of your own."] },
      { h: "Handing the review back", p: ["If you can't do it at all, hand it back from the same page. Your draft is deleted and the editor is told at once. Suggesting a replacement reviewer helps a lot."] },
      { h: "After submitting", p: ["Extensions are only for reviews you haven't submitted yet. To change a submitted review, edit it before the editor starts the decision."] },
    ],
    next: { href: "/workspace/reviews", label: "Open my reviews" },
  },
  {
    slug: "conflicts",
    title: "Conflicts of interest",
    lead: "A conflict is any reason you might not judge a paper fairly — or might look as if you couldn't.",
    minutes: 3,
    sections: [
      { h: "You have a conflict if, in the last 5 years, an author was:", list: ["your co-author,", "a colleague at the same institution,", "your supervisor or your student,", "a close collaborator, friend or family member,", "or you have a financial or competing interest in the work."] },
      { h: "What Plenary does for you", p: ["Papers you co-authored and papers from your institution are hidden from you automatically. When bidding, choosing “Conflict” removes the paper from your possible assignments for good."] },
      { h: "What you need to do", p: ["Before accepting an invitation you confirm that you have no conflict. If you only realise later, stop and tell the editor in the confidential comments or hand the review back — never review it quietly."] },
    ],
    next: { href: "/help/reviewers/blind-review", label: "Blind review: what stays hidden" },
  },
];

export const guideBySlug = (slug: string) => REVIEWER_GUIDES.find((g) => g.slug === slug) ?? null;
