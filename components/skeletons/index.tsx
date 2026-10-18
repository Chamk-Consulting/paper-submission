import { Bar, Card, Skeleton } from "@/components/skeletons/parts";

/* Route skeletons shown instantly on navigation (loading.tsx), shaped like the real screens. */

export function WorkspaceSkeleton() {
  return (
    <Skeleton className="flex min-h-dvh flex-col bg-[#F5F6F3]">
      <div className="flex h-[60px] items-center gap-5 bg-[#0E1B3D] px-6"><Bar dark w={110} h={22} /><Bar dark w={420} h={36} className="hidden md:block" /><span className="ml-auto flex gap-3"><Bar dark w={150} h={38} /><Bar dark w={40} h={40} /></span></div>
      <div className="flex flex-auto">
        <div className="hidden w-[232px] flex-none flex-col gap-3 border-r border-[#DADDE3] bg-white px-4 py-6 md:flex">{Array.from({ length: 7 }, (_, i) => <Bar key={i} w={i % 3 ? "70%" : "85%"} h={18} />)}</div>
        <div className="flex-auto px-5 py-8 sm:px-10">
          <Bar w={70} h={12} /><Bar w={320} h={38} className="mt-3" /><Bar w="60%" h={14} className="mt-3" />
          <div className="mt-8 flex flex-col gap-3">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Bar w="40%" h={16} /><Bar w="85%" h={14} className="mt-3" /><Bar w="55%" h={12} className="mt-2" /></Card>)}</div>
        </div>
      </div>
    </Skeleton>
  );
}

function PublicTop() {
  return <div className="flex h-16 items-center justify-between border-b border-[#DADDE3] bg-white px-5 sm:px-8"><Bar w={120} h={24} /><span className="flex gap-3"><Bar w={90} h={32} className="hidden sm:block" /><Bar w={140} h={36} /></span></div>;
}

export function DirectorySkeleton() {
  return (
    <Skeleton className="min-h-dvh bg-[#F5F6F3]">
      <PublicTop />
      <div className="bg-[#0E1B3D] px-5 pb-6 pt-10 sm:px-8">
        <div className="mx-auto max-w-[1216px]"><Bar dark w={130} h={12} /><Bar dark w="min(560px, 90%)" h={44} className="mt-3" /><Bar dark w="min(420px, 80%)" h={14} className="mt-3" /><Bar dark w="100%" h={52} className="mt-6" /><div className="mt-4 flex gap-2">{[90, 80, 90, 150, 140].map((w, i) => <Bar dark key={i} w={w} h={34} className="rounded-full" />)}</div></div>
      </div>
      <div className="mx-auto flex max-w-[1280px] gap-8 px-5 py-7 sm:px-8">
        <div className="hidden w-[250px] flex-none flex-col gap-3 lg:flex">{Array.from({ length: 9 }, (_, i) => <Bar key={i} w={i % 4 === 0 ? 80 : "75%"} h={i % 4 === 0 ? 11 : 16} />)}</div>
        <div className="flex flex-auto flex-col gap-3">{Array.from({ length: 4 }, (_, i) => <Card key={i} className="flex gap-4"><Bar w={56} h={56} /><div className="flex-auto"><Bar w="45%" h={20} /><Bar w="70%" h={14} className="mt-2.5" /><Bar w="55%" h={12} className="mt-2.5" /></div><div className="hidden w-[180px] sm:block"><Bar w="60%" h={12} className="ml-auto" /><Bar w="50%" h={22} className="ml-auto mt-2" /></div></Card>)}</div>
      </div>
    </Skeleton>
  );
}

export function VenueSkeleton() {
  return (
    <Skeleton className="min-h-dvh bg-[#F5F6F3]">
      <PublicTop />
      <div className="bg-white px-5 pb-7 pt-6 sm:px-8"><div className="mx-auto flex max-w-[1216px] flex-col gap-8 lg:flex-row lg:justify-between"><div className="flex-auto"><Bar w={180} h={12} /><Bar w={320} h={46} className="mt-5" /><Bar w="60%" h={18} className="mt-3" /><Bar w="50%" h={14} className="mt-3" /><div className="mt-5 flex gap-2.5"><Bar w={150} h={44} /><Bar w={140} h={44} /></div></div><div className="h-[200px] w-full rounded-[8px] bg-[#0E1B3D] p-5 lg:w-[380px]"><Bar dark w="60%" h={12} /><Bar dark w="80%" h={40} className="mt-4" /><Bar dark w="50%" h={12} className="mt-4" /></div></div></div>
      <div className="mx-auto flex max-w-[1280px] gap-10 px-5 py-8 sm:px-8"><div className="flex-auto"><Bar w={220} h={30} /><Bar w="90%" h={14} className="mt-4" /><Bar w="80%" h={14} className="mt-2" /><Bar w="85%" h={14} className="mt-2" /></div><div className="hidden w-[320px] flex-none lg:block"><Card><Bar w="50%" h={18} /><Bar w="100%" h={44} className="mt-4" /></Card></div></div>
    </Skeleton>
  );
}

export function WizardSkeleton() {
  return (
    <Skeleton className="min-h-dvh bg-[#F5F6F3]">
      <div className="flex h-[60px] items-center justify-between border-b border-[#DADDE3] bg-white px-5 sm:px-8"><Bar w={120} h={22} /><Bar w={32} h={32} className="rounded-full" /></div>
      <div className="flex flex-col gap-3 border-b border-[#DADDE3] bg-white px-5 pb-5 pt-6 sm:px-8 lg:flex-row lg:justify-between"><div><Bar w={180} h={12} /><Bar w={380} h={34} className="mt-3" /></div><Bar w={360} h={40} /></div>
      <div className="flex gap-8 px-5 py-7 sm:px-8">
        <div className="hidden w-[220px] flex-none flex-col gap-4 lg:flex"><Card className="p-3"><Bar w="50%" h={10} /><Bar w="90%" h={14} className="mt-2" /></Card>{Array.from({ length: 7 }, (_, i) => <span key={i} className="flex items-center gap-3"><Bar w={24} h={24} className="rounded-full" /><Bar w={110} h={14} /></span>)}</div>
        <div className="flex max-w-[680px] flex-auto flex-col gap-6"><Card className="p-6"><Bar w={180} h={24} /><Bar w="70%" h={14} className="mt-3" /><Bar w="100%" h={48} className="mt-6" /><Bar w="100%" h={140} className="mt-4" /></Card><Card className="p-6"><Bar w={140} h={24} /><Bar w="90%" h={14} className="mt-4" /><Bar w="80%" h={14} className="mt-2" /></Card></div>
        <div className="hidden w-[300px] flex-none flex-col gap-4 xl:flex"><Card><Bar w="40%" h={10} /><Bar w="70%" h={16} className="mt-3" /><Bar w="90%" h={12} className="mt-3" /></Card></div>
      </div>
    </Skeleton>
  );
}

export function StatusSkeleton() {
  return (
    <Skeleton className="min-h-dvh bg-[#F5F6F3]">
      <div className="flex h-[60px] items-center justify-between border-b border-[#DADDE3] bg-white px-5 sm:px-8"><Bar w={120} h={22} /><Bar w={32} h={32} className="rounded-full" /></div>
      <div className="border-b border-[#DADDE3] bg-white px-5 pb-5 pt-6 sm:px-8"><Bar w={200} h={12} /><Bar w="70%" h={32} className="mt-3" /><Bar w="40%" h={14} className="mt-3" /></div>
      <div className="flex gap-6 px-5 py-7 sm:px-8"><div className="flex flex-auto flex-col gap-4"><Card className="h-[180px]"><Bar w={120} h={24} /><Bar w="70%" h={16} className="mt-4" /><div className="mt-6 flex justify-between">{Array.from({ length: 7 }, (_, i) => <Bar key={i} w={28} h={28} className="rounded-full" />)}</div></Card><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Card key={i}><Bar w="60%" h={10} /><Bar w="50%" h={18} className="mt-2" /></Card>)}</div></div><div className="hidden w-[320px] flex-none flex-col gap-4 lg:flex">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Bar w="30%" h={10} /><Bar w="90%" h={14} className="mt-3" /><Bar w="80%" h={14} className="mt-2" /></Card>)}</div></div>
    </Skeleton>
  );
}

export function AuthSkeleton() {
  return (
    <Skeleton className="flex min-h-dvh flex-wrap bg-[#F5F6F3]">
      <div className="flex min-w-0 flex-[5_1_440px] flex-col px-5 py-7 sm:px-10"><div className="flex justify-between"><Bar w={120} h={24} /><Bar w={140} h={32} /></div><div className="mx-auto flex w-full max-w-[420px] flex-auto flex-col justify-center gap-3 py-10"><Bar w={110} h={12} /><Bar w="80%" h={40} /><Bar w="90%" h={14} /><Bar w="100%" h={48} className="mt-5" /><Bar w="100%" h={48} /><Bar w="100%" h={46} className="mt-3" /></div></div>
      <div className="hidden min-w-0 flex-[7_1_520px] flex-col justify-center gap-4 bg-[#0E1B3D] px-16 py-14 md:flex"><Bar dark w={200} h={12} /><Bar dark w="70%" h={44} /><Bar dark w="55%" h={44} /><Bar dark w="80%" h={120} className="mt-6" /></div>
    </Skeleton>
  );
}

export function LandingSkeleton() {
  return (
    <Skeleton className="min-h-dvh bg-[#0E1B3D] px-6 pt-6"><div className="mx-auto max-w-[1200px]"><div className="flex justify-between"><Bar dark w={120} h={24} /><Bar dark w={160} h={36} /></div><Bar dark w={300} h={12} className="mt-24" /><Bar dark w="min(700px, 90%)" h={70} className="mt-6" /><Bar dark w="min(600px, 80%)" h={70} className="mt-3" /><Bar dark w="min(560px, 85%)" h={18} className="mt-8" /></div></Skeleton>
  );
}
