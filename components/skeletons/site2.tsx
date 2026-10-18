import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame, type SettingsKey } from "@/components/account/settings-frame";
import { getT } from "@/lib/i18n/server";

/* Skeletons for the account pages, inbox, search and calendar (slice site2). Real chrome, shimmering data. */

const SECTIONS: Record<SettingsKey, number[]> = { profile: [150, 130, 150, 120, 140], security: [260, 150, 120, 180], notifications: [360, 110, 130, 70], privacy: [200, 170, 190, 110] };

export async function SettingsSkeleton({ active }: { active: SettingsKey }) {
  return (
    <WorkspaceShell ctx={null} active="m:settings">
      <SettingsFrame active={active}>
        <Skeleton className="flex flex-col gap-[18px]">
          {SECTIONS[active].map((h, i) => (
            <Card key={i} className="px-6! py-5!">
              <Line size={17} w={160} />
              <Line size={13} w="50%" className="mt-1" />
              <Bar w="100%" h={h - 60} className="mt-3.5" />
            </Card>
          ))}
        </Skeleton>
      </SettingsFrame>
    </WorkspaceShell>
  );
}

export async function InboxSkeleton() {
  const t = await getT();
  return (
    <WorkspaceShell ctx={null} active="inbox">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("Inbox")}</h1>
          <p className="mb-0 mt-1.5 text-[#4A5263]">{t("Messages from venues, editors, co-authors and Plenary.")}</p>
        </div>
      </div>
      <Skeleton className="mt-6 flex min-h-[760px] overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
        <div className="w-full flex-none border-r border-[#DADDE3] md:w-[380px]">
          <div className="flex gap-1.5 border-b border-[#EEF0EC] p-3.5">{[44, 72, 80, 76, 60].map((w, i) => <Bar key={i} w={w} h={30} className="rounded-full!" />)}</div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b border-[#EEF0EC] px-[18px] py-3.5">
              <div className="flex justify-between"><Line size={13} w={120} /><Line size={12} w={40} /></div>
              <Line size={15} w="80%" className="mt-1" /><Line size={13} w="90%" />
            </div>
          ))}
        </div>
        <div className="hidden flex-auto px-8 py-7 md:block">
          <Bar w={80} h={20} /><Line size={26} lh={1.2} w="60%" className="mt-3" /><Line size={13} w={200} className="mt-2" />
          <Bar w="100%" h={180} className="mt-6" />
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}

export async function SearchSkeleton() {
  const t = await getT();
  return (
    <WorkspaceShell ctx={null} active="m:search">
      <h1 className="m-0 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("Search")}</h1>
      <Skeleton>
        <Line size={15} w={320} className="mt-1.5" />
        <Bar w="min(640px, 100%)" h={44} className="mt-5" />
        <div className="mt-5 flex gap-5 border-b border-[#DADDE3] pb-2.5">{[50, 90, 70, 70, 70].map((w, i) => <Bar key={i} w={w} h={16} />)}</div>
        <div className="mt-4 flex max-w-[900px] flex-col gap-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i} className="px-[18px]! py-3.5!"><Bar w={70} h={18} /><Line size={16} w="70%" className="mt-1.5" /><Line size={13} w="45%" /></Card>
          ))}
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}

export async function CalendarSkeleton() {
  const t = await getT();
  return (
    <WorkspaceShell ctx={null} active="m:calendar">
      <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Home")} / {t("Calendar")}</p>
      <h1 className="mb-0 mt-1.5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("Add deadlines to my calendar")}</h1>
      <p className="mb-0 mt-1.5 text-[#4A5263]">{t("One live feed: it updates when a venue extends a deadline or you get a new review.")}</p>
      <Skeleton className="mt-6 flex flex-col items-start gap-6 lg:flex-row">
        <div className="flex w-full min-w-0 flex-auto flex-col gap-[18px]">
          <Card className="px-6! py-5!"><Line size={17} w={200} /><div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Bar key={i} w="100%" h={74} />)}</div></Card>
          <Card className="px-6! py-5!"><Line size={17} w={240} /><div className="mt-3.5 flex gap-2.5">{[0, 1, 2].map((i) => <Bar key={i} w={150} h={44} />)}</div><Bar w="100%" h={42} className="mt-4" /></Card>
        </div>
        <div className="flex w-full flex-col gap-[18px] lg:w-[340px] lg:flex-none">
          <Card><Line size={11} w={180} />{[0, 1, 2, 3].map((i) => <Line key={i} size={14} w="90%" className="mt-2.5" />)}</Card>
          <Card><Line size={15} w={140} /><Bar w="100%" h={60} className="mt-2" /></Card>
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}
