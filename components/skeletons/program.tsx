import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";
import { WorkspaceShell } from "@/components/workspace/shell";
import { PublicHeader, PublicFooter } from "@/components/venues/public-header";

/* Prerendered shells for the program (PG01–PG03) and session-chair (CH01, M05) pages. */

export function ProgramSkeleton({ variant = "board" }: { variant?: "board" | "session" | "list" }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[#121826]">
      <PublicHeader signedIn={false} />
      <Skeleton className="flex-auto">
        <div className="bg-[#0E1B3D]">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-5 py-7 sm:px-8">
            <Line size={13} w={180} dark />
            <Line size={36} lh={1.15} w="min(520px, 90%)" dark />
            <Line size={14} w="min(640px, 95%)" dark />
          </div>
        </div>
        <div className="mx-auto box-border w-full max-w-[1280px] px-5 py-6 sm:px-8">
          {variant === "board" ? (
            <>
              <div className="flex flex-wrap gap-3"><Bar w={320} h={40} /><Bar w={300} h={34} /></div>
              <div className="mt-6 flex flex-col gap-6 lg:flex-row">
                <div className="grid flex-auto gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }, (_, i) => <Card key={i} className="flex flex-col gap-2"><Bar w={60} h={16} /><Line size={16} w="85%" /><Line size={13} w="60%" /><Bar w={120} h={30} /></Card>)}
                </div>
                <div className="flex w-full flex-col gap-4 lg:w-[290px]"><Bar h={150} /><Bar h={120} /></div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex flex-auto flex-col gap-2.5">
                {Array.from({ length: variant === "list" ? 5 : 4 }, (_, i) => <Card key={i} className="flex flex-col gap-2"><Line size={13} w="30%" /><Line size={16} w="80%" /><Line size={13} w="50%" /></Card>)}
              </div>
              {variant === "session" ? <div className="flex w-full flex-col gap-4 lg:w-[300px]"><Bar h={160} /><Bar h={180} /></div> : null}
            </div>
          )}
        </div>
      </Skeleton>
      <PublicFooter />
    </div>
  );
}

export function ChairSkeleton() {
  return (
    <WorkspaceShell ctx={null} active="sessions">
      <Skeleton>
        <Line size={12} w={110} />
        <Line size={40} lh={1.1} w="min(420px, 90%)" className="mt-1.5" />
        <Line size={15} w="min(480px, 90%)" className="mt-1.5" />
        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <Card className="flex flex-auto flex-col gap-3">
            <Line size={20} w="60%" /><Line size={14} w="40%" />
            {Array.from({ length: 5 }, (_, i) => <Bar key={i} h={44} />)}
          </Card>
          <div className="flex w-full flex-col gap-4 lg:w-[280px]"><Bar h={140} /><Bar h={120} /></div>
        </div>
      </Skeleton>
    </WorkspaceShell>
  );
}
