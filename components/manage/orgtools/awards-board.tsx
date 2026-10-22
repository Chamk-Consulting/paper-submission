"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { Act, FieldErr, StateLine, Submit } from "@/components/manage/ops2/act";
import { announceAward, castVote, createAward, nominatePaper, pickWinner, setAwardCommittee, toggleShortlist, type OrgState } from "@/lib/manage/orgtools-actions";
import type { Award, AwardsBoard as Board } from "@/lib/manage/orgtools-data";

const no4 = (n: number) => `#${String(n).padStart(4, "0")}`;

function NewAward({ slug }: { slug: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, run] = useActionState<OrgState, FormData>(async (p, fd) => { const r = await createAward(p, fd); if (r.ok) setOpen(false); return r; }, {});
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={ui.ghost}>{t("Add an award")}</button>;
  return (
    <form action={run} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="slug" value={slug} />
      <label className="flex flex-col gap-1"><span className="sr-only">{t("Award name")}</span>
        <input name="name" required minLength={3} maxLength={80} autoFocus placeholder={t("e.g. Best student paper")} className={`${ui.input} w-64`} />
        <FieldErr state={state} name="name" />
      </label>
      <Submit className={ui.navy} pendingLabel={t("Adding…")}>{t("Add")}</Submit>
      <button type="button" onClick={() => setOpen(false)} className={ui.ghost}>{t("Cancel")}</button>
      <StateLine state={state} />
    </form>
  );
}

function Nominate({ slug, award, options }: { slug: string; award: Award; options: Board["nominable"] }) {
  const t = useT();
  const taken = new Set(award.nominations.map((n) => n.submission_id));
  const left = options.filter((o) => !taken.has(o.submission_id));
  const [state, run] = useActionState<OrgState, FormData>(nominatePaper, {});
  return (
    <form action={run} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="awardId" value={award.id} />
      <label className={ui.label}>{t("Accepted paper")}
        <select name="submissionId" required className={ui.input} defaultValue="">
          <option value="" disabled>{left.length ? t("Choose a paper") : t("No more papers to nominate")}</option>
          {left.map((o) => <option key={o.submission_id} value={o.submission_id}>{no4(o.number)} · {o.title}</option>)}
        </select>
        <FieldErr state={state} name="submissionId" />
      </label>
      <label className={ui.label}>{t("Why this paper (optional)")}<textarea name="reason" rows={2} maxLength={1000} className={ui.textarea} /><FieldErr state={state} name="reason" /></label>
      {state.ok ? <p role="status" className="m-0 text-[13px] text-[#14603F]">{t("Nominated.")}</p> : null}
      <StateLine state={state} />
      <Submit className={ui.ghost} pendingLabel={t("Saving…")} disabled={!left.length}>{t("Nominate")}</Submit>
    </form>
  );
}

function Committee({ slug, award, members }: { slug: string; award: Award; members: Board["members"] }) {
  const t = useT();
  const [state, run] = useActionState<OrgState, FormData>(setAwardCommittee, {});
  const on = new Set(award.committee.map((c) => c.person_id));
  return (
    <form action={run} className="flex flex-col gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="awardId" value={award.id} />
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
        {members.map((m) => (
          <label key={m.person_id} className="flex items-center gap-2 text-[14px] font-normal">
            <input type="checkbox" name="people" value={m.person_id} defaultChecked={on.has(m.person_id)} className="size-4" disabled={!!award.announced_at} />{m.name}
          </label>
        ))}
      </div>
      {state.ok ? <p role="status" className="m-0 text-[13px] text-[#14603F]">{t("Committee saved.")}</p> : null}
      <StateLine state={state} />
      {award.announced_at ? null : <Submit className={ui.ghost} pendingLabel={t("Saving…")}>{t("Save committee")}</Submit>}
    </form>
  );
}

export function AwardsBoard({ slug, board }: { slug: string; board: Board }) {
  const t = useT();
  const [tab, setTab] = useState(board.awards[0]?.id ?? "");
  const award = board.awards.find((a) => a.id === tab) ?? board.awards[0];
  const chair = board.is_chair;

  if (!award) {
    return (
      <section className={`${ui.card} max-w-[720px]`}>
        <h2 className={ui.h2}>{t("No awards yet")}</h2>
        <p className="m-0 mt-2 text-[15px] text-[#4A5263]">{t("Add an award such as Best paper. Associate editors then nominate accepted papers, the committee votes and you announce the winner.")}</p>
        {chair ? <div className="mt-4"><NewAward slug={slug} /></div> : null}
      </section>
    );
  }

  const shortlist = award.nominations.filter((n) => n.shortlisted);
  const step = award.announced_at ? 4 : award.winner || shortlist.length ? 3 : award.nominations.length ? 2 : 1;
  const steps = ["Nominations", "Shortlist", "Committee vote", "Announced"];
  const winner = award.nominations.find((n) => n.submission_id === award.winner);
  const announced = !!award.announced_at;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#DADDE3]">
        <div role="tablist" aria-label={t("Awards")} className="flex flex-wrap gap-[22px]">
          {board.awards.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={a.id === award.id} onClick={() => setTab(a.id)}
              className={`-mb-px border-0 border-b-2 bg-transparent px-0 py-2.5 text-[15px] ${a.id === award.id ? "border-[#F2A93B] font-semibold text-[#121826]" : "border-transparent font-medium text-[#4A5263]"}`}>
              {a.name}{a.announced_at ? " ✓" : ""}
            </button>
          ))}
        </div>
        {chair ? <div className="pb-2"><NewAward slug={slug} /></div> : null}
      </div>

      <ol className="m-0 flex list-none flex-wrap gap-2.5 p-0">
        {steps.map((l, i) => {
          const isDone = i + 1 < step, cur = i + 1 === step;
          return (
            <li key={l} aria-current={cur ? "step" : undefined} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${cur ? "bg-[#0E1B3D] text-[#F5F6F3]" : isDone ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#EEF0EC] text-[#4A5263]"}`}>
              <span className="font-mono">{isDone ? "✓" : i + 1}</span>{t(l)}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-start gap-5">
        <section className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0EC] px-[18px] py-3.5">
            <h2 className="m-0 text-[17px] font-semibold">{t("Nominations · {award}", { award: award.name })}</h2>
            <span className="text-[13px] text-[#4A5263]">{t("Shortlist up to {n} · committee of {m} votes", { n: award.max_shortlist, m: award.committee.length })}</span>
          </div>
          {award.nominations.length ? (
            <div className="overflow-x-auto">
              <table className={ui.table}>
                <thead><tr>
                  <th scope="col" className={ui.th}>{t("Shortlist")}</th><th scope="col" className={ui.th}>{t("Paper")}</th>
                  <th scope="col" className={ui.th}>{t("Nominated by")}</th><th scope="col" className={ui.th}>{t("Avg score")}</th>
                  <th scope="col" className={ui.th}>{award.i_vote && !chair ? t("Your vote") : t("Votes")}</th>
                  {chair ? <th scope="col" className={ui.th}>{t("Winner")}</th> : null}
                </tr></thead>
                <tbody>
                  {award.nominations.map((n) => {
                    const isWin = award.winner === n.submission_id;
                    const mine = award.my_vote === n.submission_id;
                    return (
                      <tr key={n.id} className={isWin ? "bg-[#FFF8EC]" : ""}>
                        <td className={ui.td}>
                          {chair && !announced ? (
                            <Act action={toggleShortlist} fields={{ slug, nominationId: n.id, on: n.shortlisted ? "false" : "true" }}
                              className={`flex size-[22px] items-center justify-center rounded-[3px] p-0 text-[13px] font-bold text-white ${n.shortlisted ? "border-0 bg-[#18744F]" : "border-[1.5px] border-[#8A93A6] bg-white"}`}>
                              <span aria-hidden>{n.shortlisted ? "✓" : ""}</span><span className="sr-only">{n.shortlisted ? t("Remove {id} from the shortlist", { id: no4(n.number) }) : t("Shortlist {id}", { id: no4(n.number) })}</span>
                            </Act>
                          ) : <span className={`${ui.tag} ${n.shortlisted ? "bg-[#E1F3EA] text-[#14603F]" : "bg-[#EEF0EC] text-[#4A5263]"}`}>{n.shortlisted ? t("Shortlisted") : t("Nominated")}</span>}
                        </td>
                        <td className={ui.td}>
                          <span className="font-mono text-[12px] text-[#4A5263]">{no4(n.number)}{n.student ? ` · ${t("student")}` : ""}</span>
                          <span className="block font-semibold">{n.title}</span>
                          {n.reason ? <span className="mt-0.5 block text-[13px] text-[#4A5263]">“{n.reason}”</span> : null}
                        </td>
                        <td className={`${ui.td} text-[#4A5263]`}>{n.nominated_by ?? "—"}</td>
                        <td className={`${ui.td} font-mono`}>{n.avg_score ?? "—"}</td>
                        <td className={`${ui.td} font-mono`}>
                          {award.i_vote && !chair ? (
                            n.conflict ? <span className="text-[12px] text-[#7A4508]">{t("Conflict")}</span>
                              : n.shortlisted && !announced ? (
                                <Act action={castVote} fields={{ slug, awardId: award.id, submissionId: n.submission_id }}
                                  className={`size-[22px] rounded-full p-0 ${mine ? "border-[7px] border-[#F2A93B]" : "border-[1.5px] border-[#8A93A6]"} bg-white`}>
                                  <span className="sr-only">{mine ? t("Your vote: {id}", { id: no4(n.number) }) : t("Vote for {id}", { id: no4(n.number) })}</span>
                                </Act>
                              ) : mine ? "✓" : "—"
                          ) : n.shortlisted && n.votes !== null ? `${n.votes} / ${award.committee.length}` : "—"}
                        </td>
                        {chair ? (
                          <td className={ui.td}>
                            {n.shortlisted && !announced ? (
                              <Act action={pickWinner} fields={{ slug, awardId: award.id, submissionId: n.submission_id }}
                                className={`size-[22px] rounded-full p-0 ${isWin ? "border-[7px] border-[#F2A93B]" : "border-[1.5px] border-[#8A93A6]"} bg-white`}>
                                <span className="sr-only">{isWin ? t("Winner: {id}", { id: no4(n.number) }) : t("Make {id} the winner", { id: no4(n.number) })}</span>
                              </Act>
                            ) : isWin ? "★" : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="m-0 px-[18px] py-6 text-[14px] text-[#4A5263]">{t("No nominations yet. Associate editors and chairs nominate accepted papers.")}</p>}
        </section>

        <aside className="flex flex-[1_1_320px] flex-col gap-4">
          <section className={ui.card}>
            <p className={ui.kicker}>{t("Winner")}</p>
            <p className="m-0 mt-2 font-serif text-[24px] leading-[1.2]">{winner ? winner.title : t("Not chosen yet")}</p>
            <p className="m-0 mt-1 text-[14px] text-[#4A5263]">{winner ? `${no4(winner.number)} · ${winner.authors ?? ""}` : t("Pick a shortlisted paper.")}</p>
            {chair ? (
              <>
                <p className="m-0 mt-3.5 mb-1.5 text-[13px] font-semibold">{t("When you announce")}</p>
                <ul className="m-0 pl-[18px] text-[14px] leading-[1.7]">
                  <li>{t("Badge on the paper and session pages")}</li><li>{t("Certificate PDF for every author")}</li><li>{t("Inbox notice to the authors")}</li>
                </ul>
                <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                  {announced ? <span className={ui.ok}>{t("Announced ✓")}</span> : (
                    <Act action={announceAward} fields={{ slug, awardId: award.id }} className={ui.primary} disabled={!winner} pendingLabel={t("Announcing…")}
                      confirm={t("Announce the winner? The authors are told and the badge goes public. This can’t be undone.")}>{t("Announce winner")}</Act>
                  )}
                  {announced ? <a href={`/api/awards/${award.id}/certificate`} className="text-[14px]">{t("Certificate (PDF)")}</a> : null}
                </div>
              </>
            ) : award.i_vote ? <p className="m-0 mt-3 text-[13px] text-[#4A5263]">{t("You are on the award committee. Vote for one shortlisted paper; you can change your vote until the chair announces.")}</p> : null}
            {chair && award.votes_cast !== null ? <p className="m-0 mt-3 text-[13px] text-[#4A5263]">{t("{n} of {m} committee votes cast", { n: award.votes_cast, m: award.committee.length })}</p> : null}
          </section>

          {!announced && board.nominable.length ? (
            <details className={ui.card} open={!award.nominations.length}>
              <summary className="cursor-pointer text-[15px] font-semibold">{t("Nominate a paper")}</summary>
              <div className="mt-3"><Nominate slug={slug} award={award} options={board.nominable} /></div>
            </details>
          ) : null}

          {chair ? (
            <details className={ui.card}>
              <summary className="cursor-pointer text-[15px] font-semibold">{t("Award committee")} ({award.committee.length})</summary>
              <div className="mt-3"><Committee slug={slug} award={award} members={board.members} /></div>
            </details>
          ) : null}

          <section className={`${ui.card} text-[14px]`}>
            <p className={ui.kicker}>{t("Conflicts")}</p>
            <p className="m-0 mt-2 text-[#4A5263]">{t("Committee members can't vote on papers they authored or are conflicted with (rule B1). Your own papers are hidden from you.")}</p>
            <Link href={`/manage/${slug}/decisions`} className="mt-2 inline-block text-[13px]">{t("Back to decisions")}</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
