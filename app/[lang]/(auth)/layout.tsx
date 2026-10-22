import { Footer, TopBar } from "@/components/auth/chrome";

/**
 * One frame for every sign-in and account page: logo + language + help on top, footer at the bottom.
 * It stays mounted between these pages. Pages add their content, and some add a right-hand panel
 * (.auth-aside: shown from 1024 px only, fixed to the right half; see globals.css).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-frame min-h-dvh bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <div className="auth-col box-border flex min-h-dvh min-w-0 flex-col px-5 py-6 sm:px-10">
        <TopBar />
        <div className="flex flex-auto flex-col">{children}</div>
        <Footer />
      </div>
    </div>
  );
}
