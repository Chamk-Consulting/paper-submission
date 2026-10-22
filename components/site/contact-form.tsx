"use client";
import { ArrowRight, Info, Upload } from "lucide-react";

import { Turnstile } from "@/components/site/turnstile";
import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { sendContact, type ContactState } from "@/lib/site/actions";
import { contact, CONTACT_TOPICS, SALES_KINDS, SALES_ROLES, SALES_SIZES, SALES_SYSTEMS } from "@/lib/config/contact";

/* Canvas CT01 (Main.dc.html): title band with Get support / Talk to sales tabs, the form and its aside. */

const field = "h-[46px] box-border rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px] font-normal text-[#121826]";
const label = "flex flex-col gap-1.5 text-[14px] font-medium";
const hint = "text-[13px] font-normal text-[#4A5263]";
export const MAX_FILES = 3;
export const MAX_BYTES = 900 * 1024;

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`min-h-10 cursor-pointer rounded-full border px-3.5 text-[14px] font-medium ${on ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6]"}`}>
      {children}
    </button>
  );
}

function Err({ list }: { list?: string[] }) {
  const t = useT();
  return list?.[0] ? <span className="text-[13px] font-normal text-[#B3261E]">{t(list[0])}</span> : null;
}

const Arrow = ({ c }: { c: string }) => <ArrowRight size={16} strokeWidth={2} color={c} aria-hidden />;

export function ContactPage({ initialTab, email, signedIn }: { initialTab: "support" | "sales"; email: string; signedIn: boolean }) {
  const t = useT();
  const [tab, setTab] = useState(initialTab);
  const [topic, setTopic] = useState<string>("submit");
  const [kind, setKind] = useState<string>("conference");
  const [len, setLen] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [fileErr, setFileErr] = useState("");
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, {});
  const fe = state.fieldErrors ?? {};
  const cur = CONTACT_TOPICS.find((x) => x[0] === topic) ?? CONTACT_TOPICS[1];

  const pickFiles = (list: FileList | null) => {
    const next = [...files, ...Array.from(list ?? [])].filter((f) => /^(image\/(png|jpeg)|application\/pdf)$/.test(f.type)).slice(0, MAX_FILES);
    const size = next.reduce((s, f) => s + f.size, 0);
    if (size > MAX_BYTES) { setFileErr(t("Files are too large together. Keep them under 900 KB in total.")); return; }
    setFileErr("");
    setFiles(next);
  };
  const submit = (fd: FormData) => {
    fd.delete("files");
    for (const f of files) fd.append("files", f);
    action(fd);
  };
  const tabCls = (on: boolean) => `h-[46px] cursor-pointer border-0 border-b-[3px] bg-transparent px-[18px] text-[15px] font-semibold ${on ? "border-[#F2A93B] text-[#121826]" : "border-transparent text-[#4A5263] hover:text-[#121826]"}`;

  return (
    <>
      <section className="border-b border-[#DADDE3] bg-white">
        <div className="mx-auto box-border max-w-[1280px] px-5 pt-10 sm:px-8">
          <p className="m-0 text-[14px] text-[#4A5263]"><Link href="/help" className="text-[#121826]">{t("Help & guides")}</Link> / {t("Contact")}</p>
          <h1 className="mt-2.5 font-serif text-[40px] font-[350] leading-[1.05] tracking-[-0.015em] sm:text-[48px]">{t("How can we help?")}</h1>
          <p className="mt-2.5 max-w-[62ch] text-[17px] text-[#4A5263]">{t("Write to the people who build Plenary. We reply within {time}, Monday to Friday, in {langs}.", { time: t(contact.replyTime), langs: t(contact.languages) })}</p>
          <div role="tablist" aria-label={t("Who do you want to reach?")} className="mt-7 flex flex-wrap gap-1">
            <button type="button" role="tab" id="tab-support" aria-controls="panel" aria-selected={tab === "support"} onClick={() => setTab("support")} className={tabCls(tab === "support")}>{t("Get support")}</button>
            <button type="button" role="tab" id="tab-sales" aria-controls="panel" aria-selected={tab === "sales"} onClick={() => setTab("sales")} className={tabCls(tab === "sales")}>{t("Talk to sales")}</button>
          </div>
        </div>
      </section>

      <div id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mx-auto box-border flex w-full max-w-[1280px] flex-auto flex-wrap items-start gap-7 px-5 pb-16 pt-7 sm:px-8">
        {tab === "support" ? (
          <>
            <div className="flex min-w-0 max-w-[760px] flex-[999_1_560px] flex-col gap-4">
              <div className="flex items-start gap-3 rounded-[8px] bg-[#E6EDFC] px-4 py-3.5 text-[14px] text-[#1F2E5C]">
                <Info size={18} strokeWidth={1.75} color="#1F47A8" className="mt-px flex-none" aria-hidden />
                <span><strong>{t("About a paper’s review, deadline or decision?")}</strong> {t("The venue’s chairs decide those, not Plenary. Message them from the paper’s page in")} <Link href="/workspace/submissions" className="text-[#1F47A8]">{t("My submissions")}</Link>.</span>
              </div>

              <form action={submit} noValidate className="flex flex-col gap-[22px] rounded-[8px] border border-[#DADDE3] bg-white p-5 sm:p-7">
              <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                <label>Company website<input type="text" name="company_website" tabIndex={-1} autoComplete="off" /></label>
              </div>
              <Turnstile />
                <input type="hidden" name="kind" value="support" />
                <input type="hidden" name="topic" value={topic} />
                {state.message ? <p role="alert" className="m-0 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3.5 py-2.5 text-[14px] text-[#8C1D18]">{t(state.message)}</p> : null}
                <fieldset className="m-0 border-0 p-0">
                  <legend className="p-0 font-semibold">{t("What is it about?")}</legend>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {CONTACT_TOPICS.map(([id, l]) => <Chip key={id} on={topic === id} onClick={() => setTopic(id)}>{t(l)}</Chip>)}
                  </div>
                  <p className="mb-0 mt-2 text-[13px] text-[#4A5263]">{t(cur[2])}</p>
                </fieldset>

                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                  <label className={label}>{t("Your email")}
                    <input name="email" type="email" defaultValue={email} readOnly={signedIn && !!email} placeholder="name@university.edu" autoComplete="email" className={`${field} ${signedIn && email ? "bg-[#F7F8F6]" : ""}`} aria-invalid={!!fe.email} />
                    <span className={hint}>{signedIn ? t("From your account. Replies go here and to your Plenary inbox.") : t("Replies go here. Signed in? Sign in first and we see your account.")}</span>
                    <Err list={fe.email} />
                  </label>
                  <label className={label}><span>{t("Paper or event")} <span className="font-normal text-[#4A5263]">{t("(optional)")}</span></span>
                    <input name="about" type="text" placeholder={t("e.g. #1234 or CDC 2027")} className={field} />
                    <span className={hint}>{t("Helps us find it faster. Never share a reviewer’s identity.")}</span>
                  </label>
                </div>

                <label className={label}>{t("Subject")}
                  <input name="subject" type="text" placeholder={t("One line, e.g. “Upload check says fonts are not embedded”")} className={field} aria-invalid={!!fe.subject} maxLength={200} />
                  <Err list={fe.subject} />
                </label>

                <label className={label}>{t("Message")}
                  <textarea name="body" rows={7} maxLength={4000} onChange={(e) => setLen(e.target.value.length)} placeholder={t("What did you try, what happened, and what did you expect?")} aria-invalid={!!fe.body}
                    className="box-border rounded-[4px] border border-[#B7BDC9] bg-white px-3 py-2.5 text-[15px] font-normal leading-[1.5] text-[#121826]" />
                  <span className="flex justify-between gap-3 text-[13px] font-normal text-[#4A5263]"><span>{t("Never send passwords or sign-in codes — we will never ask for them.")}</span><span className="font-mono">{len} / 4000</span></span>
                  <Err list={fe.body} />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[14px] font-medium">{t("Screenshot or file")} <span className="font-normal text-[#4A5263]">{t("(optional)")}</span></span>
                  <label className="relative flex cursor-pointer items-center gap-3.5 rounded-[8px] border-[1.5px] border-dashed border-[#B7BDC9] bg-[#F7F8F6] p-[18px]"
                    onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFiles(e.dataTransfer.files); }}>
                    <Upload size={26} strokeWidth={1.5} color="#4A5263" aria-hidden />
                    <span className="text-[14px]"><span className="font-semibold text-[#2F5FD0]">{t("Choose a file")}</span> {t("or drop it here")}<span className="block text-[13px] text-[#4A5263]">{t("PNG, JPG or PDF · up to 900 KB in total · 3 files at most")}</span></span>
                    <input type="file" multiple accept="image/png,image/jpeg,application/pdf" onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} className="absolute size-px overflow-hidden [clip:rect(0_0_0_0)]" />
                  </label>
                  {files.length ? (
                    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 rounded-[4px] bg-[#F7F8F6] px-3 py-1.5">
                          <span className="truncate">{f.name} <span className="text-[#4A5263]">· {Math.ceil(f.size / 1024)} KB</span></span>
                          <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="cursor-pointer border-0 bg-transparent text-[#B3261E]">{t("Remove")}</button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {fileErr ? <span role="alert" className="text-[13px] text-[#B3261E]">{fileErr}</span> : null}
                </div>

                <label className="flex items-start gap-2.5 text-[14px]">
                  <input type="checkbox" name="allow" defaultChecked className="mt-0.5 size-[18px] flex-none accent-[#0E1B3D]" />
                  <span>{t("Support may look at my account and this paper’s settings to investigate.")} <span className="text-[#4A5263]">{t("Never the content of reviews. Access ends when the ticket closes.")}</span></span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-[#EEF0EC] pt-[18px]">
                  <span className="max-w-[46ch] text-[13px] text-[#4A5263]">{t("We email you a copy with a reference number. Replies arrive in your inbox and in Plenary.")}</span>
                  <button type="submit" disabled={pending} className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-[#F2A93B] px-[22px] text-[16px] font-semibold text-[#0E1B3D] hover:bg-[#E89B26] disabled:opacity-60">
                    {pending ? t("Sending…") : t("Send message")} <Arrow c="#0E1B3D" />
                  </button>
                </div>
              </form>
            </div>

            <aside aria-label={t("Before you write")} className="flex max-w-[380px] flex-[1_1_300px] flex-col gap-3.5">
              <section className="rounded-[8px] border border-[#DADDE3] bg-white p-[18px]">
                <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Quick answers")}</p>
                <ul className="m-0 mt-2.5 flex list-none flex-col p-0">
                  {([["/forgot-password", "I can’t sign in or lost my password"], ["/help?q=upload", "My PDF fails the upload check"], ["/help?q=AoE", "Which time zone is the deadline in?"], ["/help?q=co-author", "Changing co-authors after submitting"]] as const).map(([href, l], i, a) => (
                    <li key={href} className={i < a.length - 1 ? "border-b border-[#EEF0EC]" : ""}><Link href={href} className="block py-2.5 text-[#2F5FD0] no-underline hover:underline">{t(l)}</Link></li>
                  ))}
                </ul>
              </section>
              <section className="flex items-start gap-3 rounded-[8px] border border-[#DADDE3] bg-white p-[18px]">
                <span aria-hidden className="mt-1.5 size-2.5 flex-none rounded-full bg-[#18744F]" />
                <div>
                  <div className="font-semibold">{t("All systems normal")}</div>
                  <div className="text-[13px] text-[#4A5263]">{t("Submissions, reviews and email are working.")} <Link href="/maintenance" className="text-[#2F5FD0]">{t("Status page")}</Link></div>
                </div>
              </section>
              <section id="security" className="rounded-[8px] bg-[#0E1B3D] p-[18px] text-[#F5F6F3]">
                <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#F2A93B]">{t("Security or privacy")}</p>
                <p className="mb-0 mt-2 text-[14px] text-[#D6DCEA]">{t("Found a vulnerability, or want a copy or deletion of your data? Write to {a} or {b}.", { a: contact.securityEmail, b: contact.privacyEmail })}</p>
                <Link href="/legal/security" className="mt-2.5 inline-block text-[14px] font-semibold text-[#F2A93B]">{t("Security & responsible disclosure →")}</Link>
              </section>
              <section className="px-0.5 py-1 text-[13px] text-[#4A5263]">
                <div className="font-semibold text-[#121826]">{contact.company.legalName}</div>
                <div>{contact.company.address}</div>
                <div>{contact.company.registration}</div>
              </section>
            </aside>
          </>
        ) : (
          <>
            <div className="min-w-0 max-w-[760px] flex-[999_1_560px]">
              <form action={action} noValidate className="flex flex-col gap-[22px] rounded-[8px] border border-[#DADDE3] bg-white p-5 sm:p-7">
              <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                <label>Company website<input type="text" name="company_website" tabIndex={-1} autoComplete="off" /></label>
              </div>
              <Turnstile />
                <input type="hidden" name="kind" value="sales" />
                <input type="hidden" name="eventKind" value={kind} />
                <div>
                  <h2 className="m-0 font-serif text-[26px] font-normal">{t("Plan your next conference with us")}</h2>
                  <p className="mb-0 mt-1.5 text-[#4A5263]">{t("Tell us about your event. We’ll come back with a walkthrough on your own call for papers and a price for your size.")}</p>
                </div>
                {state.message ? <p role="alert" className="m-0 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3.5 py-2.5 text-[14px] text-[#8C1D18]">{t(state.message)}</p> : null}
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                  <label className={label}>{t("Full name")}<input name="name" type="text" autoComplete="name" placeholder={t("[First name] [Last name]")} className={field} aria-invalid={!!fe.name} /><Err list={fe.name} /></label>
                  <label className={label}>{t("Work email")}<input name="email" type="email" autoComplete="email" defaultValue={email} placeholder="name@society.org" className={field} aria-invalid={!!fe.email} /><Err list={fe.email} /></label>
                  <label className={label}>{t("Institution or society")}<input name="org" type="text" autoComplete="organization" placeholder={t("e.g. IFAC, a university, a journal")} className={field} /></label>
                  <label className={label}>{t("Your role")}<select name="role" className={`${field} px-2.5`}>{SALES_ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}</select></label>
                </div>
                <fieldset className="m-0 border-0 p-0">
                  <legend className="p-0 font-semibold">{t("What are you running?")}</legend>
                  <div className="mt-2.5 flex flex-wrap gap-2">{SALES_KINDS.map(([id, l]) => <Chip key={id} on={kind === id} onClick={() => setKind(id)}>{t(l)}</Chip>)}</div>
                </fieldset>
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                  <label className={label}>{t("Expected submissions")}<select name="size" className={`${field} px-2.5`}>{SALES_SIZES.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></label>
                  <label className={label}>{t("Submission deadline")}<input name="deadline" type="month" className={field} /></label>
                  <label className={label}>{t("Using today")}<select name="system" className={`${field} px-2.5`}>{SALES_SYSTEMS.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></label>
                </div>
                <label className={label}><span>{t("Anything we should know?")} <span className="font-normal text-[#4A5263]">{t("(optional)")}</span></span>
                  <textarea name="body" rows={5} maxLength={4000} placeholder={t("Tracks, invited sessions, double-blind review, proceedings partner, languages…")} className="box-border rounded-[4px] border border-[#B7BDC9] bg-white px-3 py-2.5 text-[15px] font-normal leading-[1.5] text-[#121826]" />
                </label>
                <label className="flex items-start gap-2.5 text-[14px]">
                  <input type="checkbox" name="demo" className="mt-0.5 size-[18px] flex-none accent-[#0E1B3D]" />
                  <span>{t("I’d like a 30-minute live walkthrough.")} <span className="text-[#4A5263]">{t("We’ll propose times by email.")}</span></span>
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-[#EEF0EC] pt-[18px]">
                  <span className="max-w-[46ch] text-[13px] text-[#4A5263]">{t("We use these details only to answer you.")} <Link href="/legal/privacy" className="text-[#2F5FD0]">{t("Privacy")}</Link></span>
                  <button type="submit" disabled={pending} className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-[#0E1B3D] px-[22px] text-[16px] font-semibold text-white hover:bg-[#17285A] disabled:opacity-60">
                    {pending ? t("Sending…") : t("Send to the team")} <Arrow c="#FFFFFF" />
                  </button>
                </div>
              </form>
            </div>

            <aside aria-label={t("What happens next")} className="flex max-w-[380px] flex-[1_1_300px] flex-col gap-3.5">
              <section className="rounded-[8px] border border-[#DADDE3] bg-white p-5">
                <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("What happens next")}</p>
                <ol className="m-0 mt-3.5 flex list-none flex-col gap-3.5 p-0">
                  {([
                    [t("A reply within {time}", { time: t(contact.replyTime) }), t("From a person, not a bot, with a first price for your size.")],
                    [t("A walkthrough on your event"), t("We set up your call for papers in a sandbox so your chairs can try it.")],
                    [t("A move plan"), t("Past editions, reviewer pools and templates brought over from your current system.")],
                  ] as const).map(([h, d], i) => (
                    <li key={i} className="flex gap-3">
                      <span className={`flex size-[26px] flex-none items-center justify-center rounded-full text-[13px] font-semibold ${i === 0 ? "bg-[#F2A93B] text-[#0E1B3D]" : "box-border border-[1.5px] border-[#B7BDC9] text-[#4A5263]"}`}>{i + 1}</span>
                      <span><strong>{h}</strong><span className="block text-[14px] text-[#4A5263]">{d}</span></span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="rounded-[8px] bg-[#0E1B3D] p-5 text-[#F5F6F3]">
                <p className="m-0 font-serif text-[20px]">{t("Prefer to look first?")}</p>
                <p className="mb-0 mt-1 text-[14px] text-[#D6DCEA]">{t("See plans and what each includes.")}</p>
                <Link href="/pricing" className="mt-3 inline-flex h-10 items-center rounded-[4px] bg-[#F2A93B] px-3.5 text-[14px] font-semibold text-[#0E1B3D] no-underline">{t("See pricing")}</Link>
                <p className="mb-0 mt-3 text-[13px] text-[#D6DCEA]">{t("Or write directly to {email}", { email: contact.salesEmail })}</p>
              </section>
            </aside>
          </>
        )}
      </div>
    </>
  );
}


/** Cloudflare Turnstile CAPTCHA, shown only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set in Vercel. */
