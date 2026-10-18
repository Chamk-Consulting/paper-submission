import Link from "next/link";

/** White public header of canvas PV01/PV02. */
export function PublicHeader({ signedIn, active = "venues" }: { signedIn: boolean; active?: "venues" | "" }) {
  const nav = (href: string, label: string, on = false) => (
    <Link href={href} aria-current={on ? "page" : undefined} className={`border-b-2 py-5 no-underline ${on ? "border-[#F2A93B] text-[#121826]" : "border-transparent text-[#4A5263] hover:text-[#121826]"}`}>{label}</Link>
  );
  return (
    <header className="flex-none border-b border-[#DADDE3] bg-white">
      <div className="mx-auto flex min-h-16 max-w-[1280px] flex-wrap items-center justify-between gap-x-5 px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 text-[#121826] no-underline">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden fill="none" stroke="#121826" strokeWidth="1.5"><circle cx="11" cy="11" r="9.25" /><path d="M4 11h14M11 2v18" /><circle cx="11" cy="11" r="2.5" fill="#F2A93B" stroke="none" /></svg>
            <span className="font-serif text-[24px]">Plenary</span>
          </Link>
          <nav aria-label="Primary" className="hidden gap-6 text-[14px] font-medium md:flex">
            {nav("/venues", "Venues", active === "venues")}
            {nav("/#roles", "Authors & reviewers")}
            {nav("/#chairs", "For organizers")}
            {nav("/#pricing", "Pricing")}
          </nav>
        </div>
        <div className="flex items-center gap-3.5 py-3 text-[14px]">
          <label htmlFor="pv-lang" className="sr-only">Language</label>
          {/* TODO(i18n) */}
          <select id="pv-lang" defaultValue="English" className="hidden h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2 text-[14px] text-[#121826] sm:block"><option>English</option></select>
          {signedIn ? (
            <Link href="/workspace" className="font-medium text-[#121826] no-underline">My workspace</Link>
          ) : (
            <>
              <Link href="/sign-in?next=/venues" className="font-medium text-[#121826] no-underline">Sign in</Link>
              <Link href="/#start" className="inline-flex h-9 items-center rounded-[4px] bg-[#F2A93B] px-3.5 font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">Host a conference</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-auto flex-none border-t border-[#DADDE3] bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 px-5 py-[18px] text-[13px] text-[#4A5263] sm:px-8">
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#18744F]" />All systems normal</span>
        <span className="flex flex-wrap gap-4">
          <Link href="/legal/privacy" className="text-[#4A5263]">Privacy</Link>
          <Link href="/legal/terms" className="text-[#4A5263]">Terms</Link>
          <Link href="/legal/accessibility" className="text-[#4A5263]">Accessibility</Link>
          <Link href="/legal/security" className="text-[#4A5263]">Security</Link>
        </span>
      </div>
    </footer>
  );
}
