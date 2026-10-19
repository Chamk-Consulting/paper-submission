import { WorkspaceShell } from "@/components/workspace/shell";
import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";

/* Layout-true skeletons for EM33 similarity, EM34 awards, BL01 billing. */

function Head() {
  return (
    <>
      <Line size={12} w={180} />
      <Line size={40} lh={1.1} w="min(380px, 80%)" className="mt-1.5" />
      <Line size={15} w="min(620px, 90%)" className="mt-1.5" />
    </>
  );
}

function Shell({ active, children, wide = false }: { active: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <WorkspaceShell ctx={null} active={`m:${active}`}>
      <Skeleton className={wide ? "" : "max-w-[1180px]"}><Head /><div className="mt-[22px] flex flex-col gap-4">{children}</div></Skeleton>
    </WorkspaceShell>
  );
}

function Rows({ n = 7, cols = 4 }: { n?: number; cols?: number }) {
  return (
    <Card className="overflow-hidden p-0!">
      <Bar h={38} className="rounded-none!" />
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-[#EEF0EC] px-3.5 py-3">
          <div className="flex-auto"><Line size={12} w={52} /><Line size={14} w="70%" /></div>
          {Array.from({ length: cols - 1 }, (_, j) => <Bar key={j} w={j === 0 ? 180 : 80} h={14} />)}
        </div>
      ))}
    </Card>
  );
}

export function SimilaritySkeleton() {
  return (
    <Shell active="similarity" wide>
      <Card className="flex items-center gap-3 p-3.5!"><Line size={14} w={130} /><Bar w={52} h={30} className="rounded-full!" /><Bar w={52} h={30} className="rounded-full!" /><Bar w={52} h={30} className="rounded-full!" /><Bar w={220} h={20} className="ml-auto" /></Card>
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_560px]"><Rows n={8} /></div>
        <div className="flex flex-[1_1_340px] flex-col gap-4">
          <Card><Line size={11} w={120} /><Line size={18} w="80%" className="mt-2" /><Line size={32} w={90} className="mt-1" />{[1, 2, 3].map((i) => <Line key={i} size={14} w="90%" className="mt-2" />)}<div className="mt-3 flex gap-2"><Bar w={120} h={32} /><Bar w={120} h={32} /></div></Card>
          <Card><Line size={11} w={100} /><Line size={14} w="95%" className="mt-2" /><Line size={14} w="80%" /></Card>
        </div>
      </div>
    </Shell>
  );
}

export function AwardsSkeleton() {
  return (
    <Shell active="awards" wide>
      <div className="flex gap-5 border-b border-[#DADDE3] pb-2.5">{[1, 2, 3].map((i) => <Bar key={i} w={120} h={20} />)}</div>
      <div className="flex gap-2.5">{[1, 2, 3, 4].map((i) => <Bar key={i} w={130} h={30} className="rounded-full!" />)}</div>
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_560px]"><Rows n={5} cols={6} /></div>
        <div className="flex flex-[1_1_320px] flex-col gap-4">
          <Card><Line size={11} w={70} /><Line size={24} w="85%" className="mt-2" /><Line size={14} w="60%" className="mt-1" /><Bar w={160} h={44} className="mt-4" /></Card>
          <Card><Line size={11} w={80} /><Line size={14} w="90%" className="mt-2" /></Card>
        </div>
      </div>
    </Shell>
  );
}

export function BillingSkeleton() {
  return (
    <Shell active="billing">
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-[18px]">
          <Card><Line size={11} w={130} /><Line size={30} w={200} className="mt-2" /><div className="mt-4 grid grid-cols-3 gap-2.5">{[1, 2, 3].map((i) => <Bar key={i} h={84} />)}</div></Card>
          <Card><Line size={17} w={160} />{[1, 2, 3].map((i) => <div key={i} className="mt-3"><Line size={14} w="60%" /><Bar h={8} className="mt-1.5" /></div>)}</Card>
          <Rows n={3} cols={5} />
        </div>
        <div className="flex flex-[1_1_300px] flex-col gap-4">
          <Card><Line size={11} w={120} /><Bar h={30} className="mt-3" /><Bar w={80} h={32} className="mt-3" /></Card>
          <Card><Line size={11} w={110} />{[1, 2, 3, 4].map((i) => <Line key={i} size={14} w="85%" className="mt-2" />)}</Card>
        </div>
      </div>
    </Shell>
  );
}
