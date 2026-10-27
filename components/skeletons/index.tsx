import { Search } from "lucide-react";
import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";
import { WorkspaceShell } from "@/components/workspace/shell";
import { PublicHeader } from "@/components/venues/public-header";
import { StepRail, WizardHeader, WizardLayout } from "@/components/submission/shell";
import { SplitLayout } from "@/components/auth/split-layout";
import { Pin } from "@/components/motion/pin";
import { getT } from "@/lib/i18n/server";
import type { StepKey } from "@/lib/submission/steps";

/*
 * Skeletons are the prerendered shell of each page (passed to <Reveal>). They reuse the real chrome —
 * headers, side nav, step rail, static titles — so only the data-driven parts shimmer, and the pinned
 * chrome stays perfectly still when the content arrives.
 */

const NO_DONE = { type: false, details: false, authors: false, keywords: false, files: false, conflicts: false, review: false } as const;

/* ------------------------------------------------------------------ workspace */

export async function WorkspaceSkeleton({ active }: { active: "home" | "submissions" }) {
  const t = await getT();
  return (
    <WorkspaceShell ctx={null} active={active}>
      <Skeleton>
        {active === "home" ? (
          <>
            <Line size={12} w={100} />
            <Line size={40} lh={1.1} w="min(360px, 80%)" className="mt-1.5" />
            <Line size={15} w="min(320px, 70%)" className="mt-1.5" />
            <div className="mt-6 grid max-w-[720px] gap-3.5 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4">
                  <Line size={11} w={60} /><Line size={15} w="55%" className="mt-1" /><Line size={13} w="35%" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Author")}</p>
                <h1 className="mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("My submissions")}</h1>
                <p className="mt-1.5 text-[#4A5263]">{t("Every paper you are an author on, grouped by venue. One venue can hold several of your papers, each at its own stage.")}</p>
              </div>
              <span className="inline-flex h-[42px] items-center rounded-[4px] bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D]">{t("+ New submission")}</span>
            </div>
            <div className="mt-[22px] flex flex-col items-start gap-6 xl:flex-row">
              <div className="flex w-full min-w-0 flex-auto flex-col gap-3">
                <Bar w="100%" h={42} className="rounded-[6px]!" />
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="px-5! py-4!">
                    <div className="flex items-center gap-3"><Bar w={10} h={10} /><Line size={13} w={140} /></div>
                    <Line size={17} w={i === 1 ? "50%" : "70%"} className="mt-2" />
                    <div className="mt-3 flex gap-2">{[70, 90, 60, 80].map((w, k) => <Bar key={k} w={w} h={22} className="rounded-full!" />)}</div>
                  </Card>
                ))}
              </div>
              <div className="flex w-full flex-col gap-3.5 xl:w-[300px] xl:flex-none">
                {[96, 88, 88].map((h, i) => <Card key={i} className="px-[18px]! py-4!"><Line size={11} w={110} /><Bar w="100%" h={h - 44} className="mt-2.5" /></Card>)}
              </div>
            </div>
          </>
        )}
      </Skeleton>
    </WorkspaceShell>
  );
}

/* ------------------------------------------------------------------ public venues */

export async function DirectorySkeleton() {
  const t = await getT();
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <PublicHeader signedIn={false} />
      <Skeleton>
        <section className="bg-[#0E1B3D] text-[#F5F6F3]">
          <div className="mx-auto max-w-[1280px] px-5 pb-0 pt-10 sm:px-8">
            <p className="m-0 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#F2A93B]">{t("Event directory")}</p>
            <h1 className="mt-2 font-serif text-[36px] font-[350] leading-[1.05] tracking-[-0.015em] sm:text-[48px]">{t("Find your next call for papers")}</h1>
            <Line dark size={16} w="min(520px, 90%)" className="mt-2" />
            <div className="mt-[22px] flex h-[52px] items-center gap-2.5 rounded-[6px] bg-white px-3.5 text-[16px] text-[#6B7385]">
              <Search size={18} strokeWidth={1.75} color="#4A5263" className="flex-none" aria-hidden />
              <span className="truncate">{t("Acronym, name, topic, society or city — e.g. CDC 2027, robotics, IFAC")}</span>
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {["All fields", "Control", "Robotics", "Ocean engineering", "Systems & decision"].map((l, i) => (
                <span key={l} className="inline-flex h-[34px] items-center rounded-full px-3.5 text-[13px] font-semibold" style={{ background: i ? "transparent" : "#F2A93B", color: i ? "#D6DCEA" : "#0E1B3D", border: `1px solid ${i ? "#2A3C6E" : "#F2A93B"}` }}>{t(l)}</span>
              ))}
            </div>
            <div className="mt-6 flex gap-1 overflow-x-auto border-b border-[#24335C]">
              {["List", "Deadline calendar", "Map", "Past venues"].map((l, i) => (
                <span key={l} className="flex h-[42px] flex-none items-center px-4 text-[14px] font-semibold" style={{ color: i ? "#B9C3DA" : "#F5F6F3", borderBottom: `3px solid ${i ? "transparent" : "#F2A93B"}` }}>{t(l)}</span>
              ))}
            </div>
          </div>
        </section>
        <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col items-start gap-8 px-5 pb-14 pt-7 sm:px-8 lg:flex-row">
          <div className="hidden w-[250px] flex-none flex-col gap-[22px] lg:flex">
            {[4, 5, 4].map((n, g) => (
              <div key={g}><Line size={11} w={80} className="mb-2" />{Array.from({ length: n }, (_, i) => <span key={i} className="flex h-[30px] items-center gap-2.5"><Bar w={18} h={18} className="rounded-full!" /><Bar w={i % 2 ? 120 : 150} h={12} /></span>)}</div>
            ))}
          </div>
          <div className="flex w-full min-w-0 flex-auto flex-col gap-3">
            <div className="flex items-center justify-between"><Line size={14} w={140} /><Bar w={190} h={38} className="rounded-[6px]!" /></div>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-[18px] rounded-[8px] border border-[#DADDE3] bg-white px-5 py-[18px] sm:flex-row sm:items-start">
                <Bar w={56} h={56} className="flex-none rounded-[8px]!" />
                <div className="min-w-0 flex-auto"><Line size={22} lh={1.2} w={i % 2 ? 110 : 150} /><Line size={15} w="80%" className="mt-1.5" /><Line size={14} w="55%" className="mt-1" /><div className="mt-3 flex gap-2">{[80, 110, 70].map((w, k) => <Bar key={k} w={w} h={22} className="rounded-full!" />)}</div></div>
                <div className="hidden w-[200px] flex-none sm:block"><Line size={12} w="60%" className="ml-auto" /><Line size={22} w="75%" className="ml-auto mt-1" /><Bar w={110} h={34} className="ml-auto mt-3" /></div>
              </div>
            ))}
          </div>
        </div>
      </Skeleton>
    </div>
  );
}

/** Event page. `navy` (public): the dark cover header the page opens with. `light` (workspace): the compact white header. */
export function VenueSkeleton({ tone = "navy" }: { tone?: "navy" | "light" }) {
  const dark = tone === "navy";
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <PublicHeader signedIn={false} />
      <Skeleton>
        <div className={dark ? "bg-[#0E1B3D] px-5 pb-10 pt-7 sm:px-8 lg:min-h-[380px]" : "border-b border-[#DADDE3] bg-white px-5 pb-7 pt-6 sm:px-8"}>
          <div className="mx-auto flex max-w-[1216px] flex-col gap-8 lg:flex-row lg:justify-between">
            <div className="min-w-0 flex-auto">
              <Line dark={dark} size={14} w={200} />
              <Line dark={dark} size={46} lh={1.05} w="min(340px, 70%)" className="mt-5" />
              <Line dark={dark} size={20} w="min(620px, 90%)" className="mt-2" />
              <Line dark={dark} size={15} w="min(420px, 70%)" className="mt-2" />
              <div className="mt-5 flex flex-wrap gap-2.5"><Bar dark={dark} w={168} h={44} /><Bar dark={dark} w={140} h={44} /><Bar dark={dark} w={120} h={44} /></div>
            </div>
            <div className={`box-border w-full rounded-[8px] p-5 lg:w-[380px] lg:flex-none ${dark ? "bg-[#17285A]" : "bg-[#0E1B3D]"}`}>
              <Line dark size={12} w="55%" /><Line dark size={40} lh={1.1} w="80%" className="mt-3" /><Line dark size={13} w="65%" className="mt-3" />
              <div className="mt-4 grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((i) => <Bar dark key={i} h={46} />)}</div>
            </div>
          </div>
        </div>
        <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-10 px-5 py-8 sm:px-8 lg:flex-row">
          <div className="min-w-0 flex-auto">
            <Line size={26} w={240} />
            {[92, 84, 88, 60].map((w, i) => <Line key={i} size={16} lh={1.6} w={`${w}%`} className="mt-1" />)}
            <Card className="mt-8">{Array.from({ length: 5 }, (_, i) => <div key={i} className="flex items-center justify-between border-b border-[#EEF0EC] py-3 last:border-0"><Line size={15} w="40%" /><Line size={15} w="25%" /></div>)}</Card>
          </div>
          <div className="flex w-full flex-col gap-4 lg:w-[320px] lg:flex-none">
            <Card><Line size={18} w="55%" /><Bar w="100%" h={44} className="mt-4" /></Card>
            <Card><Line size={11} w="40%" />{[0, 1, 2].map((i) => <Line key={i} size={14} w={`${85 - i * 12}%`} className="mt-2" />)}</Card>
          </div>
        </div>
      </Skeleton>
    </div>
  );
}

/* ------------------------------------------------------------------ submission wizard */

function BandSkeleton() {
  return (
    <Pin name="wz-band">
      <div className="border-b border-[#DADDE3] bg-white">
        <div className="flex flex-col gap-3 px-5 pb-5 pt-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0"><Line size={14} w={220} /><Line size={34} lh={1.15} w="min(460px, 80vw)" className="mt-2" /></div>
          <Bar w="min(320px, 100%)" h={44} className="rounded-full!" />
        </div>
      </div>
    </Pin>
  );
}

const field = (label: number, h = 48, key?: number) => (
  <div key={key} className="mt-5 first:mt-0"><Line size={14} w={label} /><Bar w="100%" h={h} className="mt-1.5 rounded-[4px]!" /></div>
);

function StepBody({ step }: { step: StepKey }) {
  const head = <><Line size={22} w={220} /><Line size={15} w="80%" className="mt-1.5" /></>;
  switch (step) {
    case "type":
      return <><Card className="p-[22px]!">{head}<div className="mt-5 flex flex-col gap-2.5">{[0, 1, 2].map((i) => <Bar key={i} h={76} className="rounded-[8px]!" />)}</div></Card><Card className="p-[22px]!">{field(120)}</Card></>;
    case "details":
      return <><Card className="p-[22px]!">{head}<div className="mt-5">{field(80)}{field(110)}{field(90, 180)}</div></Card><Card className="p-[22px]!"><Line size={22} w={180} />{[0, 1, 2].map((i) => <div key={i} className="mt-3 flex items-center gap-3"><Bar w={20} h={20} /><Line size={15} w={`${70 - i * 10}%`} /></div>)}</Card></>;
    case "authors":
      return <Card className="p-[22px]!">{head}<div className="mt-5 flex flex-col gap-2.5">{[0, 1].map((i) => <div key={i} className="flex items-center gap-3 rounded-[8px] border border-[#DADDE3] px-3.5 py-3"><Bar w={32} h={32} className="rounded-full!" /><div className="flex-auto"><Line size={15} w="45%" /><Line size={13} w="65%" /></div><Bar w={90} h={28} /></div>)}</div>{field(160)}</Card>;
    case "keywords":
      return <Card className="p-[22px]!">{head}{[5, 7, 4].map((n, g) => <div key={g} className="mt-5"><Line size={12} w={130} /><div className="mt-2 flex flex-wrap gap-2">{Array.from({ length: n }, (_, i) => <Bar key={i} w={70 + ((i * 37) % 60)} h={32} className="rounded-full!" />)}</div></div>)}</Card>;
    case "files":
      return <Card className="p-[22px]!">{head}<Bar w="100%" h={160} className="mt-5 rounded-[8px]!" /><div className="mt-5 flex flex-col">{Array.from({ length: 5 }, (_, i) => <div key={i} className="flex items-center gap-3 border-b border-[#EEF0EC] py-3 last:border-0"><Bar w={22} h={22} className="rounded-full!" /><Line size={15} w="35%" /><Line size={14} w="25%" className="ml-auto" /></div>)}</div></Card>;
    case "conflicts":
      return <Card className="p-[22px]!">{head}<div className="mt-5 flex flex-col">{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex items-center gap-3 border-b border-[#EEF0EC] py-3 last:border-0"><Bar w={32} h={32} className="rounded-full!" /><div className="flex-auto"><Line size={15} w="40%" /><Line size={13} w="55%" /></div><Bar w={150} h={36} /></div>)}</div></Card>;
    case "review":
    default:
      return <Card className="p-[22px]!">{head}<div className="mt-5 flex flex-col">{Array.from({ length: 7 }, (_, i) => <div key={i} className="flex items-start gap-4 border-b border-[#EEF0EC] py-3.5 last:border-0"><Line size={14} w={120} /><div className="flex-auto"><Line size={15} w={`${80 - (i % 3) * 15}%`} /></div><Line size={14} w={40} /></div>)}</div></Card>;
  }
}

export function WizardSkeleton({ step }: { step: StepKey }) {
  return (
    <WizardLayout
      header={<WizardHeader initials="" />}
      band={<BandSkeleton />}
      rail={<StepRail rail={{ done: NO_DONE, current: step, reachable: 0, base: "", loading: true }} draft="loading" />}
      aside={<Skeleton className="flex flex-col gap-4"><Card className="px-[18px]! py-4!"><Line size={11} w="45%" /><Line size={16} w="75%" className="mt-2" />{[0, 1].map((i) => <Line key={i} size={14} w={`${90 - i * 20}%`} className="mt-1" />)}</Card><Bar w="100%" h={72} className="rounded-[8px]!" /></Skeleton>}
    >
      <Skeleton className="flex flex-col gap-6">
        <StepBody step={step} />
        <div className="flex items-center justify-between"><Bar w={110} h={48} /><Bar w={190} h={48} /></div>
      </Skeleton>
    </WizardLayout>
  );
}

export function StatusSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <WizardHeader initials="" />
      <Skeleton>
        <div className="border-b border-[#DADDE3] bg-white px-5 pb-5 pt-6 sm:px-8"><Line size={14} w={240} /><Line size={32} lh={1.15} w="min(640px, 85%)" className="mt-2" /><Line size={15} w="min(360px, 60%)" className="mt-2" /></div>
        <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-6 px-5 pb-16 pt-7 sm:px-8 lg:flex-row">
          <div className="flex min-w-0 flex-auto flex-col gap-4">
            <Card className="p-[22px]!"><Line size={22} w={180} /><Line size={15} w="70%" className="mt-2" /><div className="mt-6 flex justify-between">{Array.from({ length: 7 }, (_, i) => <Bar key={i} w={28} h={28} className="rounded-full!" />)}</div></Card>
            <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Card key={i} className="p-4!"><Line size={11} w="60%" /><Line size={18} w="50%" className="mt-1" /></Card>)}</div>
            <Card className="p-[22px]!">{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex gap-3 py-2.5"><Line size={13} w={90} /><Line size={15} w={`${70 - i * 8}%`} /></div>)}</Card>
          </div>
          <div className="flex w-full flex-col gap-4 lg:w-[320px] lg:flex-none">{Array.from({ length: 3 }, (_, i) => <Card key={i} className="px-[18px]! py-4!"><Line size={11} w="35%" /><Line size={14} w="90%" className="mt-2" /><Line size={14} w="75%" /></Card>)}</div>
        </div>
      </Skeleton>
    </div>
  );
}

/* ------------------------------------------------------------------ auth */

export function AuthAsideSkeleton() {
  return (
    <aside aria-hidden className="box-border flex min-h-full w-full min-w-0 flex-col justify-center bg-[#0E1B3D] px-6 py-14 sm:px-16">
      <Line dark size={12} w={200} /><Line dark size={44} lh={1.08} w="min(460px, 85%)" className="mt-3.5" /><Line dark size={44} lh={1.08} w="min(360px, 70%)" />
      <Bar dark w="min(560px, 100%)" h={120} className="mt-8 rounded-[8px]!" />
    </aside>
  );
}

/** The form column of the auth screens (title, two fields, a button). */
export function AuthFormSkeleton({ tabs = false }: { tabs?: boolean }) {
  return (
    <Skeleton className="w-full">
      {tabs ? <Bar w="100%" h={46} className="mb-6 rounded-[8px]!" /> : null}
      <Line size={40} lh={1.15} w="80%" />
      <Line size={15} w="95%" className="mt-2" /><Line size={15} w="60%" />
      {field(140, 48)}
      {field(90, 48)}
      <Bar w="100%" h={46} className="mt-6" />
      <div className="mt-3 grid grid-cols-2 gap-2.5"><Bar h={40} /><Bar h={40} /></div>
    </Skeleton>
  );
}

export function AuthSkeleton({ aside = false }: { aside?: boolean }) {
  return (
    <SplitLayout aside={<AuthAsideSkeleton />} showAside={aside}>
      <AuthFormSkeleton />
    </SplitLayout>
  );
}

/* ------------------------------------------------------------------ organizer screens */
export async function ManageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <WorkspaceShell ctx={null} active="m:setup">
      <Skeleton className="max-w-[1180px]">
        <Line size={12} w={180} />
        <Line size={40} lh={1.1} w="min(420px, 80%)" className="mt-1.5" />
        <Line size={15} w="min(520px, 90%)" className="mt-1.5" />
        <div className="mt-[22px] flex flex-col gap-4">
          {Array.from({ length: rows }, (_, i) => (
            <Card key={i} className="p-[22px]!"><Line size={22} w={200} /><Bar w="100%" h={44} className="mt-4" /><Bar w="70%" h={44} className="mt-3" /></Card>
          ))}
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}

/** Find events in the workspace: light header, three tabs, search, field chips, view tabs, then cards. Shapes only. */
export function WorkspaceDirectorySkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3]">
      <Skeleton>
        <section className="border-b border-[#DADDE3] bg-white">
          <div className="mx-auto max-w-[1280px] px-5 pt-7 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><Line size={12} w={90} /><Line size={36} lh={1.1} w="min(460px, 80vw)" className="mt-1.5" /><Line size={14} w={280} className="mt-1.5" /></div>
              <Bar w={360} h={44} className="max-w-full rounded-[8px]!" />
            </div>
            <Bar h={44} className="mt-5 rounded-[6px]!" />
            <div className="mt-3 flex flex-wrap gap-2">{[70, 70, 76, 132, 138].map((w, i) => <Bar key={i} w={w} h={32} className="rounded-full!" />)}</div>
            <div className="mt-4 flex gap-4 pb-3">{[40, 120, 40, 90].map((w, i) => <Line key={i} size={14} w={w} />)}</div>
          </div>
        </section>
        <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-3 px-5 pb-14 pt-7 sm:px-8">
          <div className="flex items-center justify-between"><Line size={14} w={120} /><Bar w={170} h={38} /></div>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-[18px] rounded-[8px] border border-[#DADDE3] bg-white p-4 sm:flex-row sm:items-start">
              <Bar w={200} h={112} className="max-w-full flex-none rounded-[6px]!" />
              <div className="min-w-0 flex-auto"><Line size={22} lh={1.2} w={i % 2 ? 110 : 150} /><Line size={14} w="75%" className="mt-1.5" /><Line size={14} w="50%" className="mt-1" /><div className="mt-2 flex gap-1.5">{[64, 72, 90].map((w, j) => <Bar key={j} w={w} h={20} />)}</div></div>
              <div className="hidden w-[220px] flex-none sm:block"><Line size={12} w="60%" className="ml-auto" /><Line size={22} w="70%" className="ml-auto mt-1" /><div className="mt-3 flex justify-end gap-1.5"><Bar w={80} h={34} /><Bar w={110} h={34} /></div></div>
            </div>
          ))}
        </div>
      </Skeleton>
    </div>
  );
}
