import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";

/** AD01: dark admin header, left nav, list + detail. */
export function AdminSkeleton() {
  return (
    <Skeleton className="flex min-h-dvh flex-col bg-[#F5F6F3]">
      <div className="bg-[#121826]">
        <div className="mx-auto box-border flex min-h-[60px] w-full max-w-[1440px] items-center gap-4 px-6">
          <Bar dark w={120} h={22} /><Bar dark w={110} h={18} /><span className="ml-auto" /><Bar dark w={180} h={14} />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1440px] flex-auto flex-wrap">
        <div className="box-border flex w-full flex-col gap-2 border-b border-[#DADDE3] bg-white px-3 py-4 md:w-[220px] md:border-b-0 md:border-r min-[1441px]:border-l">
          {[0, 1, 2, 3].map((i) => <Bar key={i} h={36} />)}
        </div>
        <div className="box-border min-w-0 flex-[999_1_560px] px-5 py-8 sm:px-10">
          <Line size={12} w={60} /><Line size={40} lh={1.1} w={320} className="mt-1.5" /><Line w={420} className="mt-1.5" />
          <div className="mt-5 flex flex-wrap gap-5">
            <Card className="flex-[1_1_320px]">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="border-b border-[#EEF0EC] py-3 last:border-0"><Line size={12} w={120} /><Line w="80%" /><Line size={13} w="50%" /></div>)}</Card>
            <Card className="flex-[999_1_420px]"><Line size={11} w={160} /><Line size={20} w="70%" className="mt-2" /><Line w="90%" className="mt-4" /><Line w="85%" /><Line w="60%" /><Bar h={120} className="mt-5" /></Card>
          </div>
        </div>
      </div>
    </Skeleton>
  );
}

/** AH02: navy band + tabs + form card. */
export function AccountHelpSkeleton() {
  return (
    <Skeleton>
      <div className="bg-[#0E1B3D] px-5 py-7 sm:px-8"><div className="mx-auto max-w-[1280px]"><Line dark size={13} w={140} /><Line dark size={40} lh={1.15} w={380} className="mt-2" /><Line dark w={480} className="mt-1" /></div></div>
      <div className="mx-auto box-border max-w-[1280px] px-5 pb-14 pt-6 sm:px-8">
        <div className="flex gap-6 border-b border-[#DADDE3] pb-2.5"><Bar w={180} h={18} /><Bar w={160} h={18} /><Bar w={110} h={18} /></div>
        <div className="mt-6 flex flex-wrap gap-6">
          <Card className="min-w-0 flex-[999_1_560px]"><Line size={17} w={220} /><Line w="80%" className="mt-2" /><div className="mt-4 grid gap-3.5 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Bar key={i} h={62} />)}</div><Bar h={44} w={150} className="mt-5" /></Card>
          <Card className="flex-[1_1_280px]"><Line size={11} w={130} /><Line w="90%" className="mt-3" /><Line w="80%" /><Line w="70%" /></Card>
        </div>
      </div>
    </Skeleton>
  );
}
