import type { ReactNode } from "react";

/**
 * The banner at the top of public pages (Organizers, Pricing, Help, Contact): one layout, one size, two colours.
 * `navy` for "selling" pages, `white` for "doing" pages. Slots: `actions` (buttons, search…), `aside` (a picture on
 * the right, large screens), `tabs` (sit flush on the bottom edge). Same 1280 px frame as the header and footer.
 */
export function PageHero({ tone = "white", kicker, title, lead, actions, aside, tabs }: {
  tone?: "navy" | "white"; kicker?: ReactNode; title: ReactNode; lead?: ReactNode; actions?: ReactNode; aside?: ReactNode; tabs?: ReactNode;
}) {
  const navy = tone === "navy";
  return (
    <section className={navy ? "bg-[#0E1B3D] text-[#F5F6F3]" : "border-b border-[#DADDE3] bg-white text-[#121826]"}>
      <div className={`mx-auto box-border max-w-[1280px] px-5 pt-12 sm:px-8 lg:pt-16 ${tabs ? "pb-0" : "pb-12 lg:pb-16"} ${aside ? "grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]" : ""}`}>
        <div className="min-w-0">
          {kicker ? <p className={`m-0 font-mono text-[12px] font-medium uppercase tracking-[0.08em] ${navy ? "text-[#F2A93B]" : "text-[#4A5263]"}`}>{kicker}</p> : null}
          <h1 className="mt-3 font-serif text-[40px] font-[350] leading-[1.05] tracking-[-0.015em] sm:text-[52px]">{title}</h1>
          {lead ? <p className={`mt-4 max-w-[60ch] text-[17px] ${navy ? "text-[#D6DCEA]" : "text-[#4A5263]"}`}>{lead}</p> : null}
          {actions ? <div className="mt-7">{actions}</div> : null}
          {tabs ? <div className="mt-8">{tabs}</div> : null}
        </div>
        {aside ? <div className="hidden lg:block">{aside}</div> : null}
      </div>
    </section>
  );
}

/** Buttons for the banner: primary (gold) and secondary (outline), right colours for each tone. */
export const heroBtn = {
  primary: "inline-flex h-12 items-center rounded-[4px] bg-[#F2A93B] px-5 text-[16px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]",
  secondaryNavy: "inline-flex h-12 items-center rounded-[4px] border border-[#3A4C7E] px-5 text-[16px] font-medium text-[#F5F6F3] no-underline hover:bg-[#17285A]",
  secondaryWhite: "inline-flex h-12 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-5 text-[16px] font-medium text-[#121826] no-underline hover:bg-[#F7F8F6]",
};
