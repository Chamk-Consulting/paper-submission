import { Bar, Card, Line, Skeleton } from "@/components/skeletons/parts";

/* Layout-true skeleton for the reviewer guide pages (authpolish slice). Public chrome width; the real page swaps in the workspace when signed in. */

export function GuideSkeleton() {
  return (
    <div className="min-h-dvh bg-[#F5F6F3] px-5 pt-[92px] sm:px-8">
      <Skeleton className="mx-auto flex max-w-[880px] flex-col">
        <Line w={180} />
        <Line size={40} lh={1.1} w="60%" className="mt-3" />
        <Line w="80%" className="mt-3" />
        <div className="mt-6 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="px-6 py-5">
              <Line size={18} w={220} />
              <Line w="95%" className="mt-3" />
              <Line w="88%" />
              <Line w="70%" />
            </Card>
          ))}
        </div>
        <Bar w={200} h={44} className="mt-6" />
      </Skeleton>
    </div>
  );
}
