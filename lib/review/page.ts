import "server-only";
import { redirect } from "next/navigation";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getReviewForm } from "@/lib/review/data";
import { getT } from "@/lib/i18n/server";
import { paperNo } from "@/lib/review/shared";

/** Common loader of /reviews/[id]/* screens: workspace ctx, the assignment's form context, translator. */
export async function loadReview(params: Promise<{ id: string }>, sub = "") {
  const { id } = await params;
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect(`/sign-in?next=${encodeURIComponent(`/reviews/${id}${sub}`)}`);
  const [form, t] = await Promise.all([getReviewForm(id), getT()]);
  return { id, ctx, form, t, no: form ? paperNo(form.paper.number) : "", ae: form?.ae ?? t("the editor") };
}
