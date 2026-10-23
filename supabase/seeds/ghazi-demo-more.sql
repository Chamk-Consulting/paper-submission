-- More papers for Ghazi so most events show several of his submissions: recent ones and planned drafts. Safe to run again.
do $$
declare
  g uuid := '8e630521-7567-4bed-bc5e-5723489cf00b';
  aff text := (select institution from public.affiliations where person_id = '8e630521-7567-4bed-bc5e-5723489cf00b' order by ends_on nulls first limit 1);
  r record; v uuid; sid uuid; i int; n int;
begin
  for r in select * from (values
    ('codit-2027', 57, 'Digital twin-based fault diagnosis for a hydraulic press line', 'Regular paper', 'submitted', 'Submitted · reviews start after the deadline', null::int, 6, array['digital twin','fault diagnosis','industrial systems'], 1, array['cdbc135e-2275-05b2-7cca-54d33f152cfa','25d85dc8-9211-663b-eff1-641130b61ab1']::uuid[], 'no', 'no', 'no'),
    ('codit-2027', null, 'Multi-criteria scheduling of electric bus charging with renewable forecasts', 'Regular paper', 'draft', 'Step 5 of 7', 5, null, array['scheduling','electric mobility'], 1, array['b62dcbdb-db87-5152-d5c5-bf2137df4939']::uuid[], 'no', 'no', 'no'),
    ('ecc-2027', null, 'Distributed Kalman filtering for formation control of underwater gliders', 'Regular paper', 'draft', 'Step 3 of 7', 3, null, array['distributed estimation','underwater vehicles'], 1, array['b79b2386-5762-997d-c495-5e3b94bd6897']::uuid[], 'no', 'no', 'no'),
    ('ecc-2027', null, 'Learning-based control of marine vehicles', 'Invited session proposal', 'draft', 'Step 1 of 7', 1, null, array['marine systems','learning-based control'], 1, array[]::uuid[], 'no', 'no', 'no'),
    ('icca-2027', 233, 'Adaptive backstepping for a tilt-rotor UAV with input saturation', 'Regular paper', 'submitted', 'Submitted', null, 10, array['adaptive control','UAV'], 2, array['b4387dcb-e8b5-a4e9-f378-d1b161ecbdff','40ec6bb7-9567-66c6-a91f-2882db1c963e']::uuid[], 'no', 'no', 'no'),
    ('icuas-2027', null, 'Wind-aware path planning for delivery drones in urban canyons', 'Regular paper', 'draft', 'Step 6 of 7', 6, null, array['path planning','UAV'], 1, array['17d3cf96-68d8-edd5-22d2-2681c07c09e2']::uuid[], 'no', 'no', 'no'),
    ('icra-2027', 1874, 'Contact-aware MPC for aerial manipulation with a compliant arm', 'Regular paper', 'review', 'In review · decisions in January', null, 38, array['aerial manipulation','MPC'], 1, array['33420749-618c-8735-b8a8-d85cc0f80ec8','f757f736-6d3a-a857-fce4-e915606a9673']::uuid[], 'no', 'no', 'no'),
    ('cdc-2026', 612, 'Stochastic MPC with chance constraints for ship collision avoidance', 'Regular paper', 'final', 'Final version accepted · presenting in December', null, 200, array['stochastic MPC','marine systems'], 1, array['70d42e92-09cc-adbf-da44-1a4b4e247763']::uuid[], 'ok', 'ok', 'ok'),
    ('acc-2027', null, 'Koopman-based estimation of battery state of health', 'Regular paper', 'draft', 'Step 2 of 7', 2, null, array['Koopman operator','estimation'], 1, array['283244fc-a74e-e503-2d4a-4610e5bb0499']::uuid[], 'no', 'no', 'no'),
    ('sysid-2027', null, 'Identification of wave-excitation models for floating wind turbines', 'Regular paper', 'draft', 'Step 4 of 7', 4, null, array['system identification','ocean energy'], 1, array['e192974f-1498-e37b-ca1e-e7ac4da8513c']::uuid[], 'no', 'no', 'no'),
    ('med-2027', 145, 'Robust control of a hexacopter after a rotor failure', 'Regular paper', 'submitted', 'Submitted', null, 4, array['robust control','fault-tolerant control'], 1, array['9fef69d7-0182-313b-e330-f4589c5e5163','68240426-285e-8ee7-6cf9-43752128572e']::uuid[], 'no', 'no', 'no'),
    ('ieee-joe', 1188, 'Learning-based station keeping of an ROV in turbulent flow', 'Regular paper', 'review', 'In review · first round', null, 12, array['ROV','learning-based control'], 1, array['3b1c198d-30a0-9621-7516-58d6868d7b73']::uuid[], 'no', 'no', 'no'),
    ('icarcv-2026', 241, 'Event-triggered formation control of USVs with communication delays', 'Regular paper', 'final', 'Final version: registration needed', null, 135, array['formation control','USV'], 1, array['40ec6bb7-9567-66c6-a91f-2882db1c963e']::uuid[], 'ok', 'ok', 'need'),
    ('ccta-2027', null, 'Gain-scheduled control of a marine crane', 'Regular paper', 'draft', 'Step 1 of 7', 1, null, array['gain scheduling','marine systems'], 1, array['65164d6d-43e6-3e2b-0cb4-201384994a25']::uuid[], 'no', 'no', 'no')
  ) as t(slug, num, title, ptype, stage, detail, step, sub_ago, kw, g_pos, others, pdf, cr, reg) loop
    select id into v from public.venues where slug = r.slug;
    continue when v is null;
    select sa.submission_id into sid from public.submission_authors sa join public.submissions x on x.id = sa.submission_id
      where sa.person_id = g and x.venue_id = v and x.title = r.title;
    continue when sid is not null;
    insert into public.submissions (venue_id, number, title, paper_type, stage, stage_detail, draft_step, pdf_check, copyright_check, registration_check,
      created_by, submitted_at, abstract, keywords, topic, created_at)
    values (v, r.num, r.title, r.ptype, r.stage::public.submission_stage, r.detail, r.step, r.pdf::public.check_state, r.cr::public.check_state, r.reg::public.check_state,
      case when r.g_pos = 1 then g else r.others[1] end, case when r.sub_ago is null then null else now() - make_interval(days => r.sub_ago) end,
      case when r.step is not null and r.step < 3 then null else 'Demo abstract: ' || r.title || '.' end, r.kw, r.kw[1],
      now() - make_interval(days => coalesce(r.sub_ago, coalesce(8 - r.step, 1) * 2) + 5))
    returning id into sid;
    i := 0;
    for n in 1 .. coalesce(array_length(r.others, 1), 0) + 1 loop
      if n = r.g_pos then
        insert into public.submission_authors (submission_id, person_id, position, is_corresponding, confirmation, responded_at, affiliation)
        values (sid, g, n, r.g_pos = 1, 'confirmed', now(), aff);
      else
        i := i + 1;
        insert into public.submission_authors (submission_id, person_id, position, is_corresponding, confirmation, responded_at, affiliation)
        values (sid, r.others[i], n, r.g_pos <> 1 and i = 1, 'confirmed', now(), (select institution from public.affiliations where person_id = r.others[i] limit 1));
      end if;
    end loop;
  end loop;
end $$;
