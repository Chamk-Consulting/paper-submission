import type { ReactNode } from "react";
import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";
import { WorkspaceShell } from "@/components/workspace/shell";

/** Workspace chrome (no ctx) around a site1 body skeleton. */
export async function WorkspaceBodySkeleton({ active, children }: { active: "home" | "m:help" | "venues"; children: ReactNode }) {
  return <WorkspaceShell ctx={null} active={active}>{children}</WorkspaceShell>;
}

/* Layout-true skeletons for the site1 slice (help, contact, venue "me", workspace home, system pages). */

export function SystemCardSkeleton() {
  return (
    <Skeleton className="mx-auto mt-10 flex max-w-[640px] flex-col items-center rounded-[12px] border border-[#DADDE3] bg-white px-6 py-11 sm:px-10">
      <Bar w={72} h={72} className="rounded-full" />
      <Line size={12} w={160} className="mt-[18px]" />
      <Line size={36} lh={1.15} w="70%" className="mt-1.5" />
      <Line w="90%" className="mt-2.5" />
      <Line w="60%" />
      <div className="mt-[22px] flex gap-2.5"><Bar w={140} h={46} /><Bar w={120} h={46} /></div>
    </Skeleton>
  );
}

export function ContactSkeleton() {
  return (
    <Skeleton className="mx-auto box-border flex w-full max-w-[1280px] flex-wrap items-start gap-7 px-5 pb-16 pt-7 sm:px-8">
      <div className="flex min-w-0 max-w-[760px] flex-[999_1_560px] flex-col gap-4">
        <Bar h={50} className="rounded-[8px]" />
        <Card className="flex flex-col gap-[22px] p-7">
          <Line w={160} />
          <div className="flex flex-wrap gap-2">{[120, 150, 100, 140, 130, 120].map((w, i) => <Bar key={i} w={w} h={40} className="rounded-full" />)}</div>
          <div className="grid gap-4 sm:grid-cols-2"><Bar h={46} /><Bar h={46} /></div>
          <Bar h={46} />
          <Bar h={170} />
          <Bar h={70} />
        </Card>
      </div>
      <div className="flex max-w-[380px] flex-[1_1_300px] flex-col gap-3.5">
        <Card className="p-[18px]"><Line size={11} w={110} />{[0, 1, 2, 3].map((i) => <Line key={i} w="85%" className="mt-3" />)}</Card>
        <Card className="p-[18px]"><Line w="60%" /><Line size={13} w="90%" /></Card>
        <Bar h={130} className="rounded-[8px]" dark />
      </div>
    </Skeleton>
  );
}

export function HelpSkeleton() {
  return (
    <Skeleton>
      <Line size={40} lh={1.1} w={300} />
      <Line w={360} className="mt-1.5" />
      <Bar h={50} className="mt-5 max-w-[720px] rounded-[6px]" />
      <div className="mt-6 grid gap-3.5 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Card key={i}><Line size={20} w={160} />{[0, 1, 2, 3].map((j) => <Line key={j} w="70%" className="mt-2.5" />)}</Card>)}
      </div>
    </Skeleton>
  );
}

export function VenueMeSkeleton() {
  return (
    <Skeleton>
      <Line size={12} w={90} />
      <Line size={40} lh={1.1} w="55%" className="mt-1.5" />
      <Line w="45%" className="mt-1.5" />
      <div className="mt-5 flex gap-6">{[90, 110, 80].map((w, i) => <Bar key={i} w={w} h={20} />)}</div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Card>{[0, 1, 2].map((i) => <div key={i} className="mt-3 flex gap-3"><Bar w={80} h={18} /><Line w="60%" /></div>)}</Card>
          <Card><Line size={20} w={160} /><Line w="80%" className="mt-3" /><Line w="70%" className="mt-2" /></Card>
        </div>
        <div className="flex flex-col gap-4"><Bar h={120} className="rounded-[8px]" dark /><Card><Line w="70%" /><Line w="50%" className="mt-2" /></Card></div>
      </div>
    </Skeleton>
  );
}

export function WorkspaceHomeSkeleton() {
  return (
    <Skeleton>
      <Line size={12} w={220} />
      <Line size={40} lh={1.1} w={360} className="mt-1.5" />
      <Line w="55%" className="mt-1.5" />
      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="p-0">
          <div className="flex gap-2 border-b border-[#EEF0EC] p-4">{[70, 90, 100, 80].map((w, i) => <Bar key={i} w={w} h={32} className="rounded-full" />)}</div>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="flex items-center gap-4 border-b border-[#EEF0EC] px-5 py-4"><Bar w={90} h={20} /><div className="flex-1"><Line w="70%" /><Line size={13} w="40%" /></div><Bar w={90} h={36} /></div>)}
        </Card>
        <div className="flex flex-col gap-4"><Bar h={200} className="rounded-[8px]" dark /><Card><Line w="50%" />{[0, 1, 2].map((i) => <Line key={i} w="85%" className="mt-2.5" />)}</Card></div>
      </div>
    </Skeleton>
  );
}
