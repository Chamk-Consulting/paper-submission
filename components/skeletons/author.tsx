import { WizardHeader, WizardLayout } from "@/components/submission/shell";
import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";

/* Skeletons for the author follow-up screens (SB10–SB15, CA01, SB13). Same geometry as FlowFrame. */

function Band() {
  return (
    <div className="border-b border-[#DADDE3] bg-white">
      <div className="flex flex-col gap-3 px-5 pb-5 pt-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-auto"><Line size={14} w={260} /><Line size={34} lh={1.15} w="min(560px, 85%)" className="mt-2" /></div>
        <Bar w={300} h={38} className="rounded-[6px]!" />
      </div>
    </div>
  );
}

function Rail({ steps }: { steps: number }) {
  return (
    <aside aria-hidden className="w-full lg:w-[220px] lg:flex-none">
      <Card className="px-3! py-2.5!"><Line size={11} w="70%" /><Line size={14} w="95%" className="mt-1" /><Line size={14} w="60%" /><Line size={12} w="55%" /></Card>
      {steps ? (
        <>
          <Line size={11} w="60%" className="mb-2 mt-5" />
          <div className="flex flex-row gap-1 lg:flex-col">{Array.from({ length: steps }, (_, i) => <div key={i} className="flex items-center gap-3 px-2.5 py-2"><Bar w={24} h={24} className="rounded-full!" /><Line size={15} w={90} /></div>)}</div>
        </>
      ) : null}
    </aside>
  );
}

function Aside() {
  return (
    <Skeleton className="flex flex-col gap-4">
      {[0, 1].map((k) => <Card key={k} className="px-[18px]! py-4!"><Line size={16} w="55%" />{[0, 1, 2].map((i) => <Line key={i} size={14} w={`${92 - i * 14}%`} className="mt-1" />)}</Card>)}
    </Skeleton>
  );
}

/** Generic follow-up step: one or two cards with fields and a button row. */
export function FlowSkeleton({ steps = 3, cards = 1, rows = 4 }: { steps?: number; cards?: number; rows?: number }) {
  return (
    <WizardLayout header={<WizardHeader initials="" />} band={<Band />} rail={<Rail steps={steps} />} aside={<Aside />}>
      <Skeleton className="flex flex-col gap-6">
        {Array.from({ length: cards }, (_, c) => (
          <Card key={c} className="p-[22px]!">
            <Line size={22} w={220} /><Line size={15} w="80%" className="mt-1" />
            {Array.from({ length: rows }, (_, i) => <div key={i} className="mt-5"><Line size={14} w={140} /><Bar w="100%" h={i === 1 ? 88 : 44} className="mt-1.5" /></div>)}
          </Card>
        ))}
        <div className="flex items-center justify-between"><Bar w={130} h={48} /><Bar w={190} h={48} /></div>
      </Skeleton>
    </WizardLayout>
  );
}

/** SB13 — decision letter + reviews. */
export function DecisionSkeleton() {
  return (
    <WizardLayout header={<WizardHeader initials="" />} band={<Band />} rail={<Rail steps={0} />} aside={<Aside />}>
      <Skeleton className="flex flex-col gap-6">
        <Card className="p-[22px]!"><Line size={12} w={120} /><Line size={26} w="60%" className="mt-2" /><Line size={14} w="40%" className="mt-1" />{Array.from({ length: 6 }, (_, i) => <Line key={i} size={15} w={`${96 - (i % 3) * 12}%`} className="mt-1.5" />)}</Card>
        {[0, 1, 2].map((i) => <Card key={i} className="p-[22px]!"><div className="flex justify-between"><Line size={17} w={140} /><Line size={14} w={120} /></div></Card>)}
      </Skeleton>
    </WizardLayout>
  );
}

/** SB15 / CA01 — body inside the workspace shell (the page wraps it in <WorkspaceShell ctx={null}>; kept out of
    this file so the viewer skeleton below stays importable from client components). */
export function WorkspaceFormSkeleton() {
  return (
      <Skeleton>
        <Line size={14} w={220} /><Line size={36} lh={1.15} w="min(520px, 80%)" className="mt-2" /><Line size={15} w="min(600px, 90%)" className="mt-2" />
        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <div className="flex min-w-0 flex-auto flex-col gap-5">{[0, 1].map((i) => <Card key={i} className="p-[22px]!"><Line size={16} w="45%" /><Bar w="100%" h={110} className="mt-4" /></Card>)}</div>
          <div className="flex w-full flex-col gap-4 lg:w-[300px] lg:flex-none">{[0, 1].map((i) => <Card key={i} className="px-[18px]! py-4!"><Line size={16} w="55%" /><Line size={14} w="90%" className="mt-2" /><Line size={14} w="70%" /></Card>)}</div>
        </div>
      </Skeleton>
  );
}

/** In-app viewer while pdf.js loads (SB05v). */
export function ViewerSkeleton() {
  return (
    <div aria-busy="true" className="flex h-full min-h-0 flex-auto gap-0">
      <div className="hidden w-[120px] flex-none flex-col gap-3 border-r border-[#DADDE3] bg-[#F5F6F3] p-3 md:flex">{[0, 1, 2, 3].map((i) => <Bar key={i} w="100%" h={120} />)}</div>
      <div className="flex min-w-0 flex-auto items-start justify-center overflow-hidden bg-[#E9EBE6] p-6"><Bar w="min(640px, 100%)" h={820} className="rounded-[2px]!" /></div>
    </div>
  );
}
