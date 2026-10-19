import { WorkspaceShell } from "@/components/workspace/shell";
import { PublicHeader } from "@/components/venues/public-header";
import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";

/* Layout-true skeletons for the attend slice: RG01 registration, BD01 badge / check-in / print sheet, PP01 paper page. */

function Head({ sub = true }: { sub?: boolean }) {
  return (
    <>
      <Line size={12} w={260} />
      <Line size={40} lh={1.1} w="min(380px, 80%)" className="mt-1.5" />
      {sub ? <Line size={15} w="min(600px, 92%)" className="mt-1.5" /> : null}
    </>
  );
}

export function RegisterSkeleton() {
  return (
    <WorkspaceShell ctx={null} active="venues">
      <Skeleton>
        <Head />
        <div className="mt-6 flex flex-col items-start gap-6 lg:flex-row">
          <div className="flex w-full min-w-0 flex-[999_1_560px] flex-col gap-[18px]">
            {[4, 2, 2].map((n, i) => (
              <Card key={i} className="px-6! py-5!"><Line size={11} w={120} />
                <div className="mt-3 flex flex-col gap-2">{Array.from({ length: n }, (_, j) => <Bar key={j} h={56} className="rounded-[6px]!" />)}</div>
              </Card>
            ))}
          </div>
          <div className="w-full lg:flex-[1_1_300px]"><Card className="px-6! py-5!"><Line size={11} w={110} /><Line size={14} className="mt-3" /><Line size={14} w="80%" /><Line size={16} w="60%" className="mt-2" /><Bar h={42} className="mt-4" /><Bar h={42} className="mt-2" /></Card></div>
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}

export function BadgeSkeleton() {
  return (
    <WorkspaceShell ctx={null} active="venues">
      <Skeleton>
        <Head />
        <div className="mt-6 flex flex-wrap items-start gap-6">
          <Card className="flex-[1_1_420px] px-6! py-5!"><Line size={11} w={110} /><Bar w={360} h={300} className="mt-4 rounded-[10px]!" /><Line size={13} w="80%" className="mt-3" /></Card>
          <Card className="flex-[1_1_420px] px-6! py-5!"><Line size={11} w={140} /><Line size={14} className="mt-3" /><Line size={14} w="70%" /><Bar h={40} w={200} className="mt-4" /></Card>
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}

export function CheckinSkeleton() {
  return (
    <WorkspaceShell ctx={null} active="m:live">
      <Skeleton className="max-w-[1180px]">
        <Head />
        <div className="mt-[22px] grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Card key={i} className="p-4!"><Line size={11} w={90} /><Line size={30} lh={1.2} w={70} className="mt-2" /></Card>)}</div>
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
          <Card><Line size={11} w={160} /><Bar h={220} className="mt-3 rounded-[8px]!" /><Bar h={40} className="mt-3" /></Card>
          <Card><Line size={17} w={140} /><Bar h={40} className="mt-3" />{Array.from({ length: 4 }, (_, i) => <div key={i} className="mt-3"><Line size={14} w="60%" /><Line size={12} w="40%" /></div>)}</Card>
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}

export function BadgeSheetSkeleton() {
  return (
    <Skeleton className="mx-auto max-w-[1180px] px-6 py-8">
      <div className="flex justify-between"><Line size={14} w={140} /><Bar w={170} h={42} /></div>
      <Line size={34} lh={1.3} w="min(360px, 80%)" className="mt-4" /><Line size={14} w="min(480px, 90%)" />
      <div className="mt-3 flex gap-1.5">{[80, 90, 130].map((w) => <Bar key={w} w={w} h={30} className="rounded-full!" />)}</div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Bar key={i} h={250} className="rounded-[10px]!" />)}</div>
    </Skeleton>
  );
}

export function PaperPageSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[#121826]">
      <PublicHeader signedIn={false} />
      <Skeleton className="flex-auto">
        <div className="bg-[#0E1B3D]">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-5 py-7 sm:px-8">
            <Line size={13} w={260} dark /><Bar w={180} h={20} dark className="mt-1" />
            <Line size={40} lh={1.15} w="min(760px, 92%)" dark className="mt-1" /><Line size={16} w="min(420px, 80%)" dark /><Line size={14} w="min(320px, 70%)" dark />
          </div>
        </div>
        <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-6 px-5 py-7 sm:px-8 lg:flex-row">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-[18px]">
            <Card className="px-6! py-5!"><Line size={17} w={100} />{Array.from({ length: 5 }, (_, i) => <Line key={i} size={16} lh={1.7} w={i === 4 ? "60%" : "100%"} className={i ? "" : "mt-2.5"} />)}</Card>
            <Card className="px-6! py-5!"><Line size={17} w={140} /><Bar h={120} className="mt-3" /></Card>
          </div>
          <div className="flex w-full flex-col gap-4 lg:flex-[1_1_300px]">{[120, 110, 110].map((h, i) => <Bar key={i} h={h} className="rounded-[8px]!" />)}</div>
        </div>
      </Skeleton>
    </div>
  );
}
