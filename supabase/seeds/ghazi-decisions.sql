-- Reviews, released decisions with letters, and history for Ghazi's decided papers (accepted / final / done /
-- rejected / revise), so every tab of their paper pages has content. Reviewers are the invented demo people,
-- never a paper's own author. Safe to run more than once: papers that already have a decision are skipped.
do $$
declare
  g uuid := '8e630521-7567-4bed-bc5e-5723489cf00b';
  pool uuid[] := array['40ec6bb7-9567-66c6-a91f-2882db1c963e','63cab95b-d4ce-cb77-9d89-4cff877d8dbf','b4387dcb-e8b5-a4e9-f378-d1b161ecbdff',
    'e4334253-98f2-8d2b-fca4-39b1dc835ac0','802d5750-a7b8-dda2-1263-6ac6bd9af47e','d49abbae-299d-eec5-416e-5f1f847adfdc',
    'f42f9d0a-c2a3-d973-74b4-e590e2d9c863','e192974f-1498-e37b-ca1e-e7ac4da8513c','65164d6d-43e6-3e2b-0cb4-201384994a25',
    'b62dcbdb-db87-5152-d5c5-bf2137df4939','1e6af22b-6b1a-9d5b-32d4-926bf63d7ba5','25d85dc8-9211-663b-eff1-641130b61ab1']::uuid[];
  good text[] := array[
    'The paper addresses a relevant problem and the method is sound. The simulation study is convincing; a comparison with a standard baseline would make the contribution clearer.

1. Section III: state the assumptions on the disturbance explicitly.
2. Figure 4: the axis labels are too small.
3. Discuss the computational cost of the proposed scheme.',
    'A well-written paper with a clear contribution. The stability proof is correct as far as I can check. Please add a short discussion of the conservatism of the bounds and of how the gains were tuned.',
    'Interesting work with a solid experimental part. The related-work section misses two recent results on the same problem; please position the paper against them. Minor: several typos in Section II.'];
  weak text[] := array[
    'The topic is relevant, but the contribution over existing work is not clear. The experiments use a single scenario and no baseline, so the claims are not supported.',
    'The method is a direct combination of known techniques. The proof in Section III has a gap (the bound on the estimation error is assumed, not shown). Not ready for publication in its current form.',
    'The presentation needs work and the results are preliminary. I encourage the authors to extend the evaluation and resubmit.'];
  r record; v_rel timestamptz; v_dec text; i int; rev uuid; a uuid; who uuid[]; v_author_ids uuid[];
begin
  for r in
    select s.id, s.number, s.title, s.stage, s.submitted_at, s.venue_id, v.short_name as acr, v.kind,
      (select min(d.starts_at) from public.venue_dates d where d.venue_id = v.id and d.kind = 'notification') as notif
    from public.submissions s join public.venues v on v.id = s.venue_id
    where s.stage in ('decision', 'final', 'done', 'rejected', 'revise')
      and exists (select 1 from public.submission_authors x where x.submission_id = s.id and x.person_id = g)
      and not exists (select 1 from public.decisions d where d.submission_id = s.id)
  loop
    v_rel := least(coalesce(r.notif, r.submitted_at + interval '60 days'), now() - interval '2 days');
    if v_rel <= r.submitted_at then v_rel := r.submitted_at + interval '21 days'; end if;
    v_dec := case r.stage when 'rejected' then 'reject' when 'revise' then 'conditional' else 'accept_oral' end;
    select array_agg(person_id) into v_author_ids from public.submission_authors where submission_id = r.id;
    -- three reviewers from the pool, never an author, rotating by paper number
    who := array(select p from unnest(pool) with ordinality u(p, o) where p <> all(v_author_ids) order by ((o + coalesce(r.number, 0)) % 12) limit 3);

    for i in 1 .. 3 loop
      rev := who[i];
      if exists (select 1 from public.review_assignments where submission_id = r.id and reviewer_id = rev) then continue; end if;
      insert into public.review_assignments (submission_id, reviewer_id, round, ordinal, status, reply_by, due_at, responded_at, coi_confirmed_at, submitted_at)
      values (r.id, rev, 1, i, 'submitted', r.submitted_at + interval '10 days', v_rel - interval '10 days', r.submitted_at + interval '6 days',
              r.submitted_at + interval '6 days', v_rel - interval '12 days' - make_interval(days => i))
      returning id into a;
      insert into public.reviews (assignment_id, scores, recommendation, confidence, to_authors, to_editor, submitted_at, updated_at)
      values (a,
        case when v_dec = 'reject' then '{"novelty":2,"quality":2,"clarity":3,"relevance":4}'::jsonb
             when v_dec = 'conditional' then '{"novelty":3,"quality":3,"clarity":3,"relevance":5}'::jsonb
             else jsonb_build_object('novelty', 4 - (i = 3)::int, 'quality', 4, 'clarity', 3 + (i = 2)::int, 'relevance', 5) end,
        case when v_dec = 'reject' then (array['reject','weak_reject','weak_reject'])[i]
             when v_dec = 'conditional' then (array['major_revision','major_revision','accept_minor'])[i]
             else (array['accept','weak_accept','accept'])[i] end,
        (array['high','medium','high'])[i],
        case when v_dec = 'reject' then weak[i] else good[i] end,
        'Reviewed in full; no conflict of interest.',
        v_rel - interval '12 days' - make_interval(days => i), v_rel - interval '12 days' - make_interval(days => i));
    end loop;

    insert into public.decisions (submission_id, decision, letter, editor_summary, drafted_at, released_at, revision_due_at)
    values (r.id, v_dec,
      case v_dec
        when 'accept_oral' then format(E'Dear authors,\n\nWe are pleased to inform you that your paper #%s, "%s", has been accepted for oral presentation at %s.\n\nPlease address the reviewers'' comments in the final version, sign the copyright form and make sure one author registers by the final-version deadline. Papers without a registered author are removed from the proceedings.\n\nCongratulations, and we look forward to seeing you at the conference.\n\nThe %s program committee', lpad(r.number::text, 4, '0'), r.title, r.acr, r.acr)
        when 'reject' then format(E'Dear authors,\n\nThank you for submitting paper #%s, "%s", to %s. After careful review, the program committee is unable to accept it this year.\n\nThe reviews are attached; we hope they help you develop the work further.\n\nThe %s program committee', lpad(r.number::text, 4, '0'), r.title, r.acr, r.acr)
        else format(E'Dear authors,\n\nYour paper #%s, "%s", needs a major revision before it can be accepted in %s. Please answer each reviewer comment and upload the revised paper with the changes highlighted.\n\nThe %s editorial board', lpad(r.number::text, 4, '0'), r.title, r.acr, r.acr) end,
      case v_dec when 'accept_oral' then 'All three reviewers recommend acceptance; please address the minor comments on presentation and the missing baseline.'
                 when 'reject' then 'The reviewers agree the contribution is not yet clear enough over existing work.'
                 else 'The reviewers see value in the work but ask for a stronger analysis and a comparison with recent results.' end,
      v_rel - interval '3 days', v_rel, case when v_dec = 'conditional' then now() + interval '21 days' else null end);

    -- history, oldest first
    insert into public.audit_log (at, actor_person_id, venue_id, action, entity, entity_id, details)
    select x.at, null, r.venue_id, x.action, 'submission', r.id, x.details from (values
      (r.submitted_at, 'submission.submitted', jsonb_build_object('number', r.number)),
      (r.submitted_at + interval '6 days', 'submission.review_started', '{}'::jsonb),
      (v_rel - interval '12 days', 'submission.reviews_complete', '{}'::jsonb),
      (v_rel, 'submission.decision_released', jsonb_build_object('decision', v_dec))
    ) as x(at, action, details)
    where not exists (select 1 from public.audit_log l where l.entity = 'submission' and l.entity_id = r.id and l.action = x.action);
    if r.stage = 'done' then
      insert into public.audit_log (at, venue_id, action, entity, entity_id, details)
      values (v_rel + interval '30 days', r.venue_id, 'submission.final_submitted', 'submission', r.id, '{}'),
             (least(now() - interval '1 day', v_rel + interval '60 days'), r.venue_id, 'submission.presented', 'submission', r.id, '{}');
    end if;
  end loop;
end $$;
