import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";
import { WorkspaceShell } from "@/components/workspace/shell";

/* Skeletons for organizer operations (EM20–EM27): page head + KPI row + the main table or two-column body. */

function Head() {
  return (
    <>
      <Line size={12} w={220} />
      <Line size={40} lh={1.1} w="min(420px, 80%)" className="mt-1.5" />
      <Line size={15} w="min(520px, 90%)" className="mt-1.5" />
    </>
  );
}

function Kpis({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <Card key={i} className="p-4!"><Line size={11} w={110} /><Line size={28} lh={1.2} w={80} className="mt-1" /><Line size={12} w={130} /></Card>
      ))}
    </div>
  );
}

function Table({ rows = 7 }: { rows?: number }) {
  return (
    <Card className="p-0!">
      <Bar h={40} className="rounded-t-[8px]" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-[#EEF0EC] px-3.5 py-3">
          <Bar w={50} h={14} /><div className="flex-auto"><Line size={14} w="70%" /><Line size={12} w="40%" /></div><Bar w={90} h={28} />
        </div>
      ))}
    </Card>
  );
}

export function OpsTableSkeleton({ active, kpis = true, filters = true, rows = 7 }: { active: string; kpis?: boolean; filters?: boolean; rows?: number }) {
  return (
    <WorkspaceShell ctx={null} active={`m:${active}`}>
      <Skeleton className="max-w-[1180px]">
        <Head />
        <div className="mt-[22px] flex flex-col gap-4">
          {kpis ? <Kpis /> : null}
          {filters ? <div className="flex gap-2"><Bar w={90} h={32} /><Bar w={140} h={32} /><Bar w={120} h={32} /><Bar w={200} h={32} className="ml-auto" /></div> : null}
          <Table rows={rows} />
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}

export function OpsSplitSkeleton({ active }: { active: string }) {
  return (
    <WorkspaceShell ctx={null} active={`m:${active}`}>
      <Skeleton className="max-w-[1180px]">
        <Head />
        <div className="mt-[22px] grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-4">
            <Card><Line size={22} w={220} /><Bar h={60} className="mt-4" /><Bar h={60} className="mt-3" /></Card>
            <Table rows={5} />
          </div>
          <div className="flex flex-col gap-4"><Card><Line size={11} w={120} /><Line size={28} w={60} className="mt-2" /></Card><Card><Bar h={120} /></Card></div>
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}

export function OpsDashboardSkeleton() {
  return (
    <WorkspaceShell ctx={null} active="m:dashboard">
      <Skeleton className="max-w-[1180px]">
        <Head />
        <div className="mt-[22px] flex flex-col gap-4">
          <Card><div className="flex justify-between gap-2">{Array.from({ length: 9 }, (_, i) => <div key={i} className="flex flex-col items-center gap-1.5"><Bar w={28} h={28} className="rounded-full" /><Line size={12} w={60} /></div>)}</div></Card>
          <Kpis />
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <Card><Line size={22} w={180} />{Array.from({ length: 4 }, (_, i) => <Bar key={i} h={52} className="mt-3" />)}</Card>
            <div className="flex flex-col gap-4"><Card><Line size={11} w={100} /><Line size={32} w={120} className="mt-2" /></Card><Card><Bar h={160} /></Card></div>
          </div>
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}
