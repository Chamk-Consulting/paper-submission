import { WorkspaceShell } from "@/components/workspace/shell";
import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";

function Head() {
  return (
    <>
      <Line size={12} w={180} />
      <Line size={40} lh={1.1} w="min(420px, 80%)" className="mt-1.5" />
      <Line size={15} w="min(520px, 90%)" className="mt-1.5" />
    </>
  );
}

function Rows({ n, cols = 4 }: { n: number; cols?: number }) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          {Array.from({ length: cols }, (_, j) => <Bar key={j} w={j === 0 ? "30%" : `${60 / cols}%`} h={16} />)}
        </div>
      ))}
    </div>
  );
}

/** Setup sub-page: sub-nav column + form cards + rules aside (EM08–EM11). */
export async function SetupFormSkeleton({ cards = 3, table = false }: { cards?: number; table?: boolean }) {
  return (
    <WorkspaceShell ctx={null} active="m:setup">
      <Skeleton className="max-w-[1180px]">
        <Head />
        <div className="mt-[22px] flex flex-col gap-6 lg:flex-row">
          <div className="hidden w-[220px] flex-none flex-col gap-2 lg:flex">
            {Array.from({ length: 8 }, (_, i) => <Bar key={i} h={34} />)}
          </div>
          <div className="flex min-w-0 flex-auto flex-col gap-5">
            {table ? <Card className="p-[22px]!"><Line size={22} w={200} /><Rows n={5} /></Card> : null}
            {Array.from({ length: cards }, (_, i) => (
              <Card key={i} className="p-[22px]!"><Line size={22} w={200} /><Bar h={44} className="mt-4" /><Bar w="70%" h={44} className="mt-3" /></Card>
            ))}
          </div>
          <div className="hidden w-[280px] flex-none xl:block">
            <Card><Line size={12} w={120} />{Array.from({ length: 5 }, (_, i) => <Line key={i} size={13} className="mt-2.5" />)}</Card>
          </div>
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}

export const CommitteeSkeleton = () => <SetupFormSkeleton cards={2} table />;

/** People / audit: filter chips + a table. */
export async function TableSkeleton({ active, rows = 8 }: { active: string; rows?: number }) {
  return (
    <WorkspaceShell ctx={null} active={`m:${active}`}>
      <Skeleton className="max-w-[1180px]">
        <Head />
        <div className="mt-[22px] flex flex-wrap gap-2">{Array.from({ length: 6 }, (_, i) => <Bar key={i} w={96} h={32} className="rounded-full" />)}</div>
        <Card className="mt-4 p-[22px]!"><Rows n={rows} /></Card>
      </Skeleton>
    </WorkspaceShell>
  );
}

/** EMR1 My roles & conflicts. */
export async function RolesSkeleton() {
  return (
    <WorkspaceShell ctx={null} active="m:roles">
      <Skeleton className="max-w-[1180px]">
        <Head />
        <div className="mt-[22px] flex flex-col gap-5">
          <Card className="p-[22px]!"><Line size={22} w={160} /><Rows n={4} cols={3} /></Card>
          <Card className="p-[22px]!"><Line size={22} w={220} /><Rows n={3} cols={2} /></Card>
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}

/** Standalone invitation page (no workspace shell). */
export function InviteSkeleton() {
  return (
    <main className="mx-auto max-w-[560px] px-4 py-16">
      <Skeleton>
        <Card className="p-8!">
          <Line size={12} w={140} />
          <Line size={30} lh={1.2} w="80%" className="mt-2" />
          <Line size={15} className="mt-3" /><Line size={15} w="70%" />
          <div className="mt-6 flex gap-3"><Bar w={140} h={44} /><Bar w={120} h={44} /></div>
        </Card>
      </Skeleton>
    </main>
  );
}
