import { WorkspaceShell } from "@/components/workspace/shell";
import { SettingsFrame } from "@/components/account/settings-frame";
import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";

/* Skeletons of the data slice (UN01, ST05): same boxes as the loaded pages, so nothing jumps. */

export function UnsubscribeSkeleton() {
  return (
    <Skeleton>
      <Card className="p-6! sm:p-8!">
        <div className="flex items-start gap-3.5"><Bar w={40} h={40} className="rounded-full!" /><div className="flex-auto"><Line size={11} w={120} /><Line size={34} lh={1.15} w="55%" className="mt-1" /><Line w="80%" className="mt-1.5" /></div></div>
        <Line size={13} w={90} className="mt-6" />
        <div className="mt-2 flex flex-col gap-2">{[0, 1, 2].map((i) => <Bar key={i} h={48} />)}</div>
        <Bar h={70} className="mt-5" />
        <div className="mt-5 flex gap-3"><Bar w={90} h={42} /><Bar w={220} h={42} /></div>
      </Card>
    </Skeleton>
  );
}

export async function ExportSkeleton() {
  return (
    <WorkspaceShell ctx={null} active="m:settings">
      <SettingsFrame active="privacy">
        <Skeleton className="flex flex-col gap-[18px]">
          <Line size={13} w={160} />
          <Card className="px-6! py-5!"><div className="flex items-center gap-4"><Bar w={48} h={48} /><div className="flex-auto"><Line size={19} w={220} /><Line size={14} w="70%" className="mt-1" /></div><Bar w={140} h={42} /></div></Card>
          <Card className="px-6! py-5!"><Line size={17} w={140} /><div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">{[0, 1, 2, 3, 4, 5].map((i) => <Bar key={i} h={76} />)}</div></Card>
          <Card className="px-6! py-5!"><Line size={17} w={140} /><Bar h={140} className="mt-3" /></Card>
        </Skeleton>
      </SettingsFrame>
    </WorkspaceShell>
  );
}
