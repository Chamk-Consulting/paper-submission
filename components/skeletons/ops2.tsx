import { WorkspaceShell } from "@/components/workspace/shell";
import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";

/* Layout-true skeletons for EM28 finals, registrations, EM29 program, EM31 event day, EM32 proceedings, EM41 email centre. */

type Active = "finals" | "program" | "live" | "proceedings" | "email";

function Head() {
  return (
    <>
      <Line size={12} w={180} />
      <Line size={40} lh={1.1} w="min(380px, 80%)" className="mt-1.5" />
      <Line size={15} w="min(560px, 90%)" className="mt-1.5" />
    </>
  );
}

function Kpis({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: n }, (_, i) => <Card key={i} className="p-4!"><Line size={11} w={90} /><Line size={30} lh={1.2} w={70} className="mt-2" /><Line size={12} w={130} className="mt-1" /></Card>)}
    </div>
  );
}

function TableRows({ rows = 8 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden p-0!">
      <Bar h={38} className="rounded-none!" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-[#EEF0EC] px-3.5 py-3">
          <Bar w={52} h={14} /><div className="flex-auto"><Line size={14} w="70%" /><Line size={12} w="40%" /></div><Bar w={160} h={14} /><Bar w={80} h={20} />
        </div>
      ))}
    </Card>
  );
}

function Shell({ active, children, wide = false }: { active: Active; children: React.ReactNode; wide?: boolean }) {
  return (
    <WorkspaceShell ctx={null} active={`m:${active}`}>
      <Skeleton className={wide ? "" : "max-w-[1180px]"}><Head /><div className="mt-[22px] flex flex-col gap-4">{children}</div></Skeleton>
    </WorkspaceShell>
  );
}

export function FinalsSkeleton() {
  return <Shell active="finals"><Kpis /><div className="flex gap-2"><Bar w={110} h={34} /><Bar w={110} h={34} /><Bar w={80} h={34} /></div><TableRows rows={9} /></Shell>;
}

export function RegistrationsSkeleton() {
  return <Shell active="finals"><Kpis n={3} /><div className="grid gap-4 lg:grid-cols-[1fr_340px]"><TableRows rows={8} /><Card><Line size={22} w={180} /><Bar h={44} className="mt-4" /><Bar h={44} className="mt-3" /><Bar h={120} className="mt-3" /></Card></div></Shell>;
}

export function ProgramSkeleton() {
  return (
    <Shell active="program" wide>
      <div className="flex gap-2">{[1, 2, 3, 4].map((i) => <Bar key={i} w={110} h={34} />)}</div>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card><Line size={11} w={120} />{Array.from({ length: 6 }, (_, i) => <Bar key={i} h={52} className="mt-3" />)}</Card>
        <Card className="p-0!"><Bar h={46} className="rounded-none!" />{Array.from({ length: 4 }, (_, i) => <div key={i} className="grid grid-cols-[90px_1fr_1fr_1fr] gap-3 border-b border-[#EEF0EC] p-3"><Bar h={40} />{[1, 2, 3].map((j) => <Bar key={j} h={120} />)}</div>)}</Card>
      </div>
    </Shell>
  );
}

export function LiveSkeleton() {
  return (
    <Shell active="live">
      <Kpis />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Card key={i} className="p-4!"><Line size={15} w={120} /><Bar w={80} h={18} className="mt-2" /><Line size={13} w="90%" className="mt-2" /><Bar h={6} className="mt-3" /></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]"><TableRows rows={5} /><Card><Line size={22} w={160} /><Bar h={120} className="mt-4" /><Bar w={180} h={44} className="mt-3" /></Card></div>
    </Shell>
  );
}

export function ProceedingsSkeleton() {
  return (
    <Shell active="proceedings">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-3">{[1, 2, 3, 4].map((i) => <Card key={i} className="flex items-center gap-4 p-4!"><Bar w={32} h={32} className="rounded-full!" /><div className="flex-auto"><Line size={16} w="50%" /><Line size={13} w="70%" /></div><Bar w={110} h={40} /></Card>)}<TableRows rows={3} /></div>
        <div className="flex flex-col gap-3"><Card><Line size={22} w={160} /><div className="mt-3 grid grid-cols-2 gap-3">{[1, 2, 3, 4, 5, 6].map((i) => <Bar key={i} h={54} />)}</div></Card><Card><Line size={22} w={120} />{[1, 2, 3, 4].map((i) => <Line key={i} size={14} w="80%" className="mt-2" />)}</Card></div>
      </div>
    </Shell>
  );
}

export function EmailSkeleton() {
  return (
    <Shell active="email">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Card><Line size={22} w={180} /><div className="mt-4 flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((i) => <Bar key={i} w={120} h={34} className="rounded-full!" />)}</div><Line size={14} w={220} className="mt-4" /></Card>
          <Card><Line size={22} w={140} /><Bar h={44} className="mt-4" /><Bar h={180} className="mt-3" /></Card>
          <Card><Line size={22} w={100} /><Bar w={220} h={44} className="mt-4" /></Card>
        </div>
        <Card><Line size={22} w={140} />{[1, 2, 3, 4, 5].map((i) => <Line key={i} size={14} w="90%" className="mt-2" />)}</Card>
      </div>
      <TableRows rows={4} />
    </Shell>
  );
}
