import { getOpenCalls } from "@/lib/venues/open-calls";
import { OpenCallRows, OpenCallsError } from "@/components/open-calls/rows";

/** Server part: fetches real open calls and hands them to the live client rows (or the error state). */
export async function OpenCallsList({ tone, limit }: { tone: "dark" | "light"; limit: number }) {
  const res = await getOpenCalls(limit);
  if (res.status === "error") return <OpenCallsError tone={tone} />;
  return <OpenCallRows calls={res.calls} generatedAt={res.generatedAt} tone={tone} />;
}
