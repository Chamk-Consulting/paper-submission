import { PublicHeader } from "@/components/venues/public-header";
import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";

/** Archive of a past edition (PV01p → /venues/[slug]/archive). */
export function ArchiveSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <PublicHeader signedIn={false} />
      <Skeleton>
        <div className="border-b border-[#DADDE3] bg-white px-5 pb-7 pt-6 sm:px-8">
          <div className="mx-auto max-w-[1216px]">
            <Line size={14} w={220} />
            <Line size={46} lh={1.05} w="min(320px, 70%)" className="mt-5" />
            <Line size={20} w="min(560px, 90%)" className="mt-2" />
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Bar key={i} h={76} />)}</div>
          </div>
        </div>
        <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-8 px-5 py-8 sm:px-8">
          {[0, 1].map((k) => (
            <div key={k}>
              <Line size={26} w={220} />
              <Card className="mt-4">{Array.from({ length: 5 }, (_, i) => <div key={i} className="flex items-center justify-between gap-4 border-b border-[#EEF0EC] py-3 last:border-0"><Line size={15} w="55%" /><Line size={13} w="20%" /></div>)}</Card>
            </div>
          ))}
        </div>
      </Skeleton>
    </div>
  );
}

/** "Venue page" card on the organizer setup screen (EM10). */
export function VenuePageCardSkeleton() {
  return (
    <Skeleton>
      <Card className="mt-6"><Line size={18} w="40%" />{[0, 1, 2, 3].map((i) => <Bar key={i} h={40} className="mt-3" />)}</Card>
    </Skeleton>
  );
}
