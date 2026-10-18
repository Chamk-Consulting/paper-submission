import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { InboxList, ThreadView } from "@/components/account/inbox";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getInbox, getThreadMessages } from "@/lib/account/data";
import { getT } from "@/lib/i18n/server";

/* Server part of IN01, shared by /inbox and /inbox/[threadId]. */
export async function InboxPage({ threadId }: { threadId: string | null }) {
  const [ctx, rows, t] = await Promise.all([getWorkspaceCtx(), getInbox(), getT()]);
  if (!ctx) redirect(`/sign-in?next=/inbox${threadId ? `/${threadId}` : ""}`);
  const row = threadId ? rows.find((r) => r.thread_id === threadId) ?? null : null;
  if (threadId && !row) redirect("/inbox");
  const messages = row ? await getThreadMessages(row.thread_id) : [];

  return (
    <WorkspaceShell ctx={ctx} active="inbox">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">{t("Inbox")}</h1>
          <p className="mb-0 mt-1.5 text-[#4A5263]">{t("Messages from venues, editors, co-authors and Plenary.")}</p>
        </div>
        <Link href="/settings/notifications" className="text-[14px] text-[#2F5FD0]">{t("Email settings →")}</Link>
      </div>
      <div className="mt-[22px] flex min-h-[760px] overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
        <InboxList rows={rows} selected={row?.thread_id ?? null} />
        {row ? <ThreadView key={row.thread_id} row={row} messages={messages} /> : (
          <div className="hidden flex-auto items-center justify-center p-10 text-center text-[14px] text-[#4A5263] md:flex">
            {rows.length ? t("Pick a message to read it.") : t("When chairs, editors or co-authors write to you, their messages appear here.")}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
