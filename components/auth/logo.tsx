import Link from "@/components/site/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[#121826] no-underline">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden fill="none" stroke="#121826" strokeWidth="1.5">
        <circle cx="11" cy="11" r="9.25" /><path d="M4 11h14M11 2v18" /><circle cx="11" cy="11" r="2.5" fill="#F2A93B" stroke="none" />
      </svg>
      <span className="font-serif text-[24px]">Plenary</span>
    </Link>
  );
}
