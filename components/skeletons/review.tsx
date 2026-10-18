import { WorkspaceShell } from "@/components/workspace/shell";
import { PublicHeader } from "@/components/venues/public-header";
import { Bar, Line, Skeleton } from "@/components/skeletons/parts";

/* Loading skeletons of the reviewer screens (RV01–RV10). Real chrome, shimmering body in the same layout. */

const card = "rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4";

function Body({ variant }: { variant: "list" | "form" | "viewer" | "narrow" }) {
  if (variant === "viewer") {
    return (
      <>
        <Line size={13} w={180} />
        <Line size={32} lh={1.2} w="min(560px, 90%)" className="mt-2" />
        <div className="mt-5 flex flex-col gap-4 xl:flex-row">
          <div className={`${card} flex-auto`}><Bar h={620} /></div>
          <div className={`${card} xl:w-[360px]`}><Line size={14} w="60%" /><Line size={13} /><Line size={13} w="80%" /><Line size={13} w="70%" className="mt-3" /></div>
        </div>
      </>
    );
  }
  const main = variant === "list" ? (
    <div className={card}>
      <Line size={22} w={160} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mt-4 flex items-center gap-4"><Bar w={90} h={16} /><div className="flex-auto"><Line size={15} w="70%" /><Line size={13} w="40%" /></div><Bar w={96} h={36} /></div>
      ))}
    </div>
  ) : (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className={card}><Line size={22} w={200} /><Line size={14} w="55%" className="mt-2" /><Bar h={variant === "narrow" ? 60 : 110} className="mt-3" /></div>
      ))}
    </>
  );
  return (
    <>
      <Line size={13} w={160} />
      <Line size={40} lh={1.12} w="min(380px, 80%)" className="mt-2" />
      <Line size={15} w="min(520px, 90%)" className="mt-1.5" />
      <div className="mt-[22px] flex flex-col items-start gap-6 xl:flex-row">
        <div className="flex w-full min-w-0 flex-auto flex-col gap-4">{main}</div>
        <div className="flex w-full flex-col gap-3.5 xl:w-[300px] xl:flex-none">
          {[0, 1].map((i) => <div key={i} className={card}><Line size={11} w={90} /><Line size={28} w={70} className="mt-1" /><Line size={13} w="80%" /></div>)}
        </div>
      </div>
    </>
  );
}

export function ReviewSkeleton({ variant = "form" }: { variant?: "list" | "form" | "viewer" | "narrow" }) {
  return (
    <WorkspaceShell ctx={null} active="reviews">
      <Skeleton><Body variant={variant} /></Skeleton>
    </WorkspaceShell>
  );
}

/** RV02e — public page, no workspace chrome. */
export function InviteTokenSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3]">
      <PublicHeader signedIn={false} active="" />
      <Skeleton className="mx-auto w-full max-w-[1080px] px-5 py-8 sm:px-8">
        <Line size={12} w={200} />
        <Line size={36} lh={1.15} w="min(520px, 90%)" className="mt-2" />
        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <div className={`${card} flex-auto`}><Line size={14} w={180} /><Line size={22} w="80%" className="mt-2" /><Bar h={120} className="mt-3" /><Bar h={44} w={240} className="mt-4" /></div>
          <div className={`${card} lg:w-[300px]`}><Line size={11} w={80} /><Line size={28} w={110} /><Line size={13} className="mt-3" /><Line size={13} w="70%" /></div>
        </div>
      </Skeleton>
    </div>
  );
}
