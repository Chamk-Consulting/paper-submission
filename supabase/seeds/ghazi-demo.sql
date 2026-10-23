-- Demo data for Ghazi Rabeh (PL-8574-7907) on the real events imported on 2026-10-23, so every part of the workspace
-- has something to show: papers at every stage, a co-author request, reviews to answer / write / done, follows,
-- registrations, a talk, a session he chairs, and one event he organises.
--
-- Real events only get PRIVATE data (his papers, reviews, registrations, follows): no organiser roles, no programs.
-- Organising is shown on "Plenary Sandbox Conference 2027", an invented event clearly marked as a sandbox.
-- Co-authors and other authors are the invented demo people already in the database. Safe to run more than once.
do $$
declare
  g uuid := '8e630521-7567-4bed-bc5e-5723489cf00b';
  aff text := (select institution from public.affiliations where person_id = '8e630521-7567-4bed-bc5e-5723489cf00b' order by ends_on nulls first limit 1);
  diego uuid := '68240426-285e-8ee7-6cf9-43752128572e'; fatima uuid := '9fef69d7-0182-313b-e330-f4589c5e5163';
  marc uuid := '963ff989-e013-9bcf-0914-c507c975e72f'; chloe uuid := '0b47debb-62b4-a36a-29b3-905b707b7f22';
  wei uuid := 'b4387dcb-e8b5-a4e9-f378-d1b161ecbdff'; kenji uuid := '40ec6bb7-9567-66c6-a91f-2882db1c963e';
  yuki uuid := 'e4334253-98f2-8d2b-fca4-39b1dc835ac0'; elena uuid := '63cab95b-d4ce-cb77-9d89-4cff877d8dbf';
  chiara uuid := '802d5750-a7b8-dda2-1263-6ac6bd9af47e'; mateus uuid := 'cdbc135e-2275-05b2-7cca-54d33f152cfa';
  arjun uuid := '70d42e92-09cc-adbf-da44-1a4b4e247763'; priya uuid := '283244fc-a74e-e503-2d4a-4610e5bb0499';
  amara uuid := '6a33737d-bade-b5ef-06ed-7d141cabd9f1'; ingrid uuid := 'b79b2386-5762-997d-c495-5e3b94bd6897';
  lucia uuid := '3b1c198d-30a0-9621-7516-58d6868d7b73'; daniel uuid := '0fe7a8b6-4ac2-bdaa-b7a0-839a566f2144';
  sofia uuid := '25d85dc8-9211-663b-eff1-641130b61ab1'; jaewon uuid := '33420749-618c-8735-b8a8-d85cc0f80ec8';
  lukas uuid := 'b62dcbdb-db87-5152-d5c5-bf2137df4939'; hannah uuid := 'f757f736-6d3a-a857-fce4-e915606a9673';
  mehmet uuid := 'd49abbae-299d-eec5-416e-5f1f847adfdc'; olivia uuid := '1e6af22b-6b1a-9d5b-32d4-926bf63d7ba5';
  noah uuid := '17d3cf96-68d8-edd5-22d2-2681c07c09e2'; samuel uuid := '1b53646d-3cf3-4baa-2b59-ae297482eab2';
  ana uuid := '6206548f-57a0-dfca-558b-e00c695efd05'; erik uuid := 'e192974f-1498-e37b-ca1e-e7ac4da8513c';
  tomas uuid := '65164d6d-43e6-3e2b-0cb4-201384994a25'; aisha uuid := 'f42f9d0a-c2a3-d973-74b4-e590e2d9c863';
  gmail text := (select u.email from auth.users u join public.persons pp on pp.user_id = u.id where pp.id = '8e630521-7567-4bed-bc5e-5723489cf00b');
  sb uuid; s uuid; rm1 uuid; rm2 uuid; rm3 uuid; ses uuid; v uuid; a uuid; n int;
  today date := current_date;
begin
  -- ------------------------------------------------------------- helpers as inline statements
  -- paper(slug, number, title, type, stage, detail, step, submitted_days_ago, abstract, keywords, corresponding_is_g, coauthors[])
  create temp table if not exists _p (slug text, num int, title text, ptype text, stage public.submission_stage, detail text, step int,
    sub_ago int, abstract text, kw text[], g_pos int, g_conf text, others uuid[], pdf public.check_state, cr public.check_state, reg public.check_state) on commit drop;
  truncate _p;
  insert into _p values
  ('cnca-2026', 41, 'Fault-tolerant control of a quadrotor under actuator degradation using adaptive sliding modes', 'Regular paper', 'done', 'Presented · in the proceedings', null, 120,
   'We design an adaptive sliding-mode controller that keeps a quadrotor stable when one or more rotors lose efficiency, with experiments on a 1.2 kg platform.', array['fault-tolerant control','sliding mode','UAV'], 1, 'confirmed', array[diego, fatima], 'ok', 'ok', 'ok'),
  ('icstcc-2026', 112, 'Event-triggered distributed estimation over lossy sensor networks', 'Regular paper', 'done', 'Presented on 22 Oct', null, 150,
   'An event-triggered consensus filter that reduces communication by 60% while keeping the estimation error bounded under packet loss.', array['distributed estimation','event-triggered','sensor networks'], 2, 'confirmed', array[elena, chiara], 'ok', 'ok', 'ok'),
  ('icarcv-2026', 208, 'Vision-based landing of a fixed-wing UAV on a moving ship deck', 'Regular paper', 'final', 'Final version: copyright form missing', null, 140,
   'A monocular pipeline estimates the deck pose and feeds a model predictive controller for autonomous landing in sea state 4.', array['vision-based control','UAV','marine robotics'], 1, 'confirmed', array[kenji, yuki], 'ok', 'need', 'need'),
  ('adconip-2026', 37, 'Economic MPC for a wastewater treatment plant with uncertain inflow', 'Regular paper', 'rejected', 'Not accepted · reviews available', null, 145,
   'We compare robust and stochastic economic MPC formulations on the BSM1 benchmark under realistic inflow scenarios.', array['economic MPC','process control'], 1, 'confirmed', array[mateus], 'no', 'no', 'no'),
  ('icsc-2026', 63, 'Observer-based consensus for heterogeneous multi-agent systems with switching topologies', 'Contributed paper', 'review', 'In review · 2 of 3 reviews in', null, 16,
   'Distributed observers let agents with different dynamics reach output consensus when the communication graph switches.', array['multi-agent systems','consensus','observers'], 3, 'pending', array[marc, chloe], 'no', 'no', 'no'),
  ('icc-2027', 154, 'Learning-based robust MPC for autonomous surface vessels', 'Contributed paper', 'final', 'Camera-ready due 29 Oct', null, 93,
   'Gaussian-process models of the hull dynamics tighten the constraints of a tube MPC for docking in currents.', array['learning-based control','MPC','marine systems'], 1, 'confirmed', array[arjun, priya], 'need', 'need', 'need'),
  ('iscs-2027', 88, 'Data-driven predictive control of a flexible robot arm', 'Regular paper', 'review', 'In review', null, 7,
   'Behavioural systems theory replaces the model in a predictive controller for a two-link flexible arm; experiments show 40% less vibration.', array['data-driven control','flexible robots'], 1, 'confirmed', array[jaewon], 'no', 'no', 'no'),
  ('icca-2027', null, 'Safe reinforcement learning for multi-UAV formation flight', 'Regular paper', 'draft', 'Step 4 of 7', 4, null,
   'Control barrier functions keep a learned formation policy safe during training and deployment.', array['reinforcement learning','formation control'], 1, 'confirmed', array[wei], 'no', 'no', 'no'),
  ('icuas-2027', 19, 'Cooperative aerial transport of a cable-suspended load with three quadrotors', 'Contributed paper', 'submitted', 'Submitted · reviews start after 5 Feb', null, 3,
   'A distributed controller shares the load among three quadrotors and damps the swing using only onboard sensing.', array['aerial manipulation','cooperative control'], 1, 'confirmed', array[noah, hannah], 'no', 'no', 'no'),
  ('codit-2027', null, 'Decision support for predictive maintenance of wind turbines', 'Regular paper', 'draft', 'Step 2 of 7', 2, null,
   null, null, 1, 'confirmed', array[]::uuid[], 'no', 'no', 'no'),
  ('ecc-2027', 412, 'Resilient synchronization of power-electronic inverters under cyber attacks', 'Paper', 'submitted', 'Submitted · deadline 31 Oct', null, 2,
   'A resilient consensus layer keeps grid-forming inverters synchronized when a minority of their measurements is falsified.', array['resilient control','power systems','cyber-physical security'], 2, 'confirmed', array[lukas, olivia], 'no', 'no', 'no'),
  ('ieee-joe', 1093, 'Adaptive heading control of an underwater glider in internal waves', 'Regular paper', 'revise', 'Major revision · response due in 3 weeks', null, 80,
   'An adaptive controller estimates the disturbance caused by internal waves and keeps a glider on its heading with 45% less rudder effort.', array['underwater vehicles','adaptive control','ocean engineering'], 1, 'confirmed', array[ingrid, lucia], 'no', 'no', 'no');

  -- create the papers
  declare r record; sid uuid; i int;
  begin
    for r in select * from _p loop
      select id into v from public.venues where slug = r.slug;
      continue when v is null;
      select sa.submission_id into sid from public.submission_authors sa join public.submissions x on x.id = sa.submission_id
        where sa.person_id = g and x.venue_id = v and x.title = r.title;
      if sid is null then
        insert into public.submissions (venue_id, number, title, paper_type, stage, stage_detail, draft_step, pdf_check, copyright_check, registration_check,
          created_by, submitted_at, abstract, keywords, topic, created_at)
        values (v, r.num, r.title, r.ptype, r.stage, r.detail, r.step, r.pdf, r.cr, r.reg,
          case when r.g_pos = 1 then g else r.others[1] end, case when r.sub_ago is null then null else now() - make_interval(days => r.sub_ago) end,
          r.abstract, coalesce(r.kw, '{}'::text[]), r.kw[1], now() - make_interval(days => coalesce(r.sub_ago, 5) + 10))
        returning id into sid;
        -- authors: Ghazi at his position, the others around him
        i := 0;
        for n in 1 .. coalesce(array_length(r.others, 1), 0) + 1 loop
          if n = r.g_pos then
            insert into public.submission_authors (submission_id, person_id, position, is_corresponding, confirmation, responded_at, affiliation)
            values (sid, g, n, r.g_pos = 1, r.g_conf, case when r.g_conf = 'confirmed' then now() else null end, aff);
          else
            i := i + 1;
            insert into public.submission_authors (submission_id, person_id, position, is_corresponding, confirmation, responded_at, affiliation)
            values (sid, r.others[i], n, r.g_pos <> 1 and i = 1, 'confirmed', now(),
                    (select institution from public.affiliations where person_id = r.others[i] limit 1));
          end if;
        end loop;
      end if;
    end loop;
  end;

  -- ------------------------------------------------------------- papers by others that Ghazi reviews (real events, private)
  declare rv record; sid uuid;
  begin
    for rv in select * from (values
      ('icsc-2026', 71, 'Finite-time stabilization of underactuated marine vehicles', array[mehmet, aisha], 'accepted', 9, null::int),
      ('iscs-2027', 95, 'Hybrid observers for legged locomotion on uneven terrain', array[kenji, yuki], 'invited', 21, 4),
      ('ieee-joe', 1102, 'Cooperative localization of AUV swarms with acoustic ranging', array[ingrid, erik], 'accepted', 12, null),
      ('cnca-2026', 58, 'Control de temperatura en invernaderos mediante MPC económico', array[diego, mateus], 'submitted', -60, null),
      ('icuas-euam', 31, 'Regulatory pathways for beyond-visual-line-of-sight drone delivery', array[samuel, olivia], 'submitted', -20, null)
    ) as t(slug, num, title, authors, status, due_days, reply_days) loop
      select id into v from public.venues where slug = rv.slug;
      continue when v is null;
      select id into sid from public.submissions where venue_id = v and title = rv.title;
      if sid is null then
        insert into public.submissions (venue_id, number, title, paper_type, stage, created_by, submitted_at, abstract, keywords)
        values (v, rv.num, rv.title, 'Regular paper', case when rv.status = 'submitted' then 'decision'::public.submission_stage else 'review' end,
                rv.authors[1], now() - interval '40 days', 'Abstract hidden in this demo.', array['control'])
        returning id into sid;
        insert into public.submission_authors (submission_id, person_id, position, is_corresponding, confirmation, responded_at)
        select sid, p, o, o = 1, 'confirmed', now() from unnest(rv.authors) with ordinality as u(p, o);
      end if;
      if not exists (select 1 from public.review_assignments where submission_id = sid and reviewer_id = g) then
        insert into public.review_assignments (submission_id, reviewer_id, round, ordinal, status, reply_by, due_at, responded_at, coi_confirmed_at, submitted_at)
        values (sid, g, 1, 2, rv.status,
                case when rv.reply_days is null then now() - interval '10 days' else now() + make_interval(days => rv.reply_days) end,
                now() + make_interval(days => rv.due_days),
                case when rv.status = 'invited' then null else now() - interval '12 days' end,
                case when rv.status = 'invited' then null else now() - interval '12 days' end,
                case when rv.status = 'submitted' then now() + make_interval(days => rv.due_days) - interval '2 days' else null end)
        returning id into a;
        if rv.status = 'submitted' then
          insert into public.reviews (assignment_id, scores, recommendation, confidence, to_authors, to_editor, submitted_at, updated_at)
          values (a, '{"originality":4,"technical_quality":4,"clarity":3,"relevance":5}'::jsonb, 'accept', 'high',
            'The paper addresses a relevant problem and the method is sound. The experimental section would benefit from a comparison with a standard baseline and a short discussion of computational cost. Figures 3 and 4 need larger axis labels. Overall a clear contribution.',
            'Solid paper; minor revisions.', now() + make_interval(days => rv.due_days) - interval '2 days', now());
        elsif rv.status = 'accepted' and rv.slug = 'ieee-joe' then
          insert into public.reviews (assignment_id, scores, recommendation, confidence, to_authors, updated_at)
          values (a, '{"originality":4,"technical_quality":3}'::jsonb, null, 'medium', 'Draft: the localization method is interesting; check the observability argument in Section III.', now());
        end if;
      end if;
    end loop;
  end;

  -- ------------------------------------------------------------- follows and registrations (real events, private)
  insert into public.venue_follows (person_id, venue_id)
  select g, id from public.venues where slug in ('icca-2027', 'icuas-2027', 'codit-2027', 'ecc-2027', 'ieee-joe', 'icuas-euam', 'icarcv-2026', 'adconip-2026')
  on conflict do nothing;

  if not exists (select 1 from public.registrations r join public.venues x on x.id = r.venue_id where x.slug = 'cnca-2026' and r.person_id = g) then
    insert into public.registrations (venue_id, person_id, number, reg_type, full_name, email, affiliation, covers_papers, paid_at, badges, source, status, payment_method,
      invoice_number, amount_cents, currency, items, checked_in_at)
    select id, g, 'CNCA-0412', 'AMCA professional', 'Ghazi Rabeh', gmail, aff, 2, '2026-08-30', 1, 'manual', 'confirmed', 'card',
      'CNCA-INV-0412', 450000, 'MXN', '[{"qty":1,"kind":"ticket","name":"AMCA professional","unit_cents":450000}]'::jsonb, '2026-10-07 08:41-06'
    from public.venues where slug = 'cnca-2026';
  end if;
  if not exists (select 1 from public.registrations r join public.venues x on x.id = r.venue_id where x.slug = 'icarcv-2026' and r.person_id = g) then
    insert into public.registrations (venue_id, person_id, number, reg_type, full_name, email, affiliation, covers_papers, badges, source, status, payment_method,
      invoice_number, amount_cents, currency, items)
    select id, g, 'ARCV-2208', 'Author (full)', 'Ghazi Rabeh', gmail, aff, 1, 1, 'manual', 'awaiting_payment', 'invoice',
      'ARCV-INV-2208', 75000, 'USD', '[{"qty":1,"kind":"ticket","name":"Author (full)","unit_cents":75000}]'::jsonb
    from public.venues where slug = 'icarcv-2026';
  end if;

  -- ------------------------------------------------------------- the sandbox event Ghazi organises
  select id into sb from public.venues where slug = 'plenary-sandbox-2027';
  if sb is null then
    insert into public.venues (slug, name, short_name, kind, starts_on, ends_on, location, timezone, website, field, format, review_mode, page_limit,
      accepting, city, country, region, latitude, longitude, place_hint, details, imported_from, tagline, public_text, venue_address, contact_email,
      status, is_test, is_published, double_blind, created_by)
    values ('plenary-sandbox-2027', 'Plenary Sandbox Conference 2027 (sandbox)', 'PSC 2027', 'conference', '2027-05-18', '2027-05-21', 'Monastir, Tunisia',
      'Africa/Tunis', null, 'control', 'hybrid', 'Double-blind', '6 + 2 pages', 'Regular papers, short papers',
      'Monastir', 'Tunisia', 'Africa & Middle East', 35.7643, 10.8113, 'Seaside campus', jsonb_build_object(
        'sandbox', 'Sandbox event for trying Plenary — not a real conference',
        'cfp', 'A sandbox conference for trying every part of Plenary: submissions, reviews, decisions, program and registration. People and papers are invented; nothing is published.',
        'topics', array['Robust and nonlinear control', 'Learning-based control', 'Marine and aerial robotics', 'Estimation and filtering'],
        'organizers', jsonb_build_array(jsonb_build_object('role', 'General chair', 'name', 'Ghazi Rabeh', 'org', aff))),
      'sandbox', 'Sandbox event — try every part of Plenary', 'PSC 2027 is a sandbox event for trying Plenary. People and papers are invented.',
      'Seaside Congress Hall (fictional), Monastir', 'psc2027@plenary.example', 'program', false, true, true, g)
    returning id into sb;
  end if;
  insert into public.venue_members (venue_id, person_id, role) values (sb, g, 'owner'), (sb, g, 'program_chair'), (sb, g, 'session_chair'),
    (sb, amara, 'chair'), (sb, kenji, 'reviewer'), (sb, elena, 'reviewer'), (sb, wei, 'reviewer'), (sb, priya, 'associate_editor')
  on conflict do nothing;
  if not exists (select 1 from public.venue_dates where venue_id = sb) then
    insert into public.venue_dates (venue_id, kind, label, starts_at, ends_at, key) values
      (sb, 'conference', 'Conference', '2027-05-18 09:00+01', '2027-05-21 18:00+01', 'conference'),
      (sb, 'submission', 'Paper submission', now() - interval '20 days', null, 'paper_deadline'),
      (sb, 'review', 'Reviews due', now() + interval '10 days', null, 'reviews_due'),
      (sb, 'notification', 'Notification of acceptance', now() + interval '30 days', null, 'decisions'),
      (sb, 'final', 'Final versions and copyright', now() + interval '60 days', null, 'finals'),
      (sb, 'registration', 'Early registration', now() + interval '90 days', null, 'registration');
  end if;

  -- sandbox submissions at every stage (one is Ghazi's own, as co-author, presented in the program)
  if not exists (select 1 from public.submissions where venue_id = sb) then
    insert into public.submissions (venue_id, number, title, paper_type, stage, stage_detail, created_by, submitted_at, abstract, keywords, pdf_check, copyright_check, registration_check)
    select sb, t.num, t.title, 'Regular paper', t.stage::public.submission_stage, t.detail, t.a1, now() - interval '25 days', 'Sandbox abstract.', array[t.kw], t.pdf::public.check_state, t.cr::public.check_state, t.rg::public.check_state
    from (values
      (1, 'Adaptive cruise control with learned driver models', 'review', '3 of 3 reviews in', kenji, 'learning-based control', 'no', 'no', 'no'),
      (2, 'Robust attitude control of small satellites', 'review', '1 of 3 reviews in', elena, 'robust control', 'no', 'no', 'no'),
      (3, 'Swarm coverage with energy constraints', 'review', 'Needs a reviewer', wei, 'multi-agent systems', 'no', 'no', 'no'),
      (4, 'Kalman filtering with intermittent observations revisited', 'decision', 'Accept recommended', yuki, 'estimation', 'no', 'no', 'no'),
      (5, 'Model-free control of soft grippers', 'final', 'Final version uploaded', chiara, 'soft robotics', 'ok', 'ok', 'need'),
      (6, 'Disturbance observers for wave energy converters', 'final', 'Copyright missing', ingrid, 'marine systems', 'ok', 'need', 'ok'),
      (7, 'Graph neural networks for power-flow estimation', 'rejected', 'Not accepted', lukas, 'power systems', 'no', 'no', 'no'),
      (8, 'Distributed MPC for irrigation canals', 'submitted', null, mateus, 'process control', 'no', 'no', 'no'),
      (9, 'Event-based vision for drone racing', 'withdrawn', 'Withdrawn by authors', noah, 'aerial robotics', 'no', 'no', 'no'),
      (10, 'Sliding-mode observers for underwater manipulators', 'final', 'Ready', g, 'marine robotics', 'ok', 'ok', 'ok')
    ) as t(num, title, stage, detail, a1, kw, pdf, cr, rg);
    insert into public.submission_authors (submission_id, person_id, position, is_corresponding, confirmation, responded_at, affiliation)
    select x.id, x.created_by, 1, true, 'confirmed', now(), (select institution from public.affiliations where person_id = x.created_by limit 1)
    from public.submissions x where x.venue_id = sb on conflict do nothing;
    -- Ghazi's own sandbox paper gets a co-author
    insert into public.submission_authors (submission_id, person_id, position, is_corresponding, confirmation, responded_at)
    select id, fatima, 2, false, 'confirmed', now() from public.submissions where venue_id = sb and number = 10 on conflict do nothing;
    -- reviews on the sandbox papers by the sandbox reviewers
    insert into public.review_assignments (submission_id, reviewer_id, round, ordinal, status, reply_by, due_at, responded_at, submitted_at)
    select x.id, r.p, 1, r.o, case when x.number = 1 or (x.number in (2, 4) and r.o = 1) or x.number = 4 then 'submitted' else 'accepted' end,
           now() - interval '15 days', now() + interval '10 days', now() - interval '14 days',
           case when x.number = 1 or (x.number in (2, 4) and r.o = 1) or x.number = 4 then now() - interval '2 days' else null end
    from public.submissions x cross join lateral (values (kenji, 1), (elena, 2), (wei, 3)) as r(p, o)
    where x.venue_id = sb and x.number in (1, 2, 4) and r.p <> x.created_by;
    insert into public.reviews (assignment_id, scores, recommendation, confidence, to_authors, submitted_at, updated_at)
    select ra.id, '{"originality":4,"technical_quality":4,"clarity":4,"relevance":4}'::jsonb, 'accept', 'medium',
           'Clear contribution with convincing experiments; minor comments on notation.', ra.submitted_at, now()
    from public.review_assignments ra join public.submissions x on x.id = ra.submission_id where x.venue_id = sb and ra.status = 'submitted';
  end if;

  -- program: rooms, two sessions, Ghazi chairs one and presents in the other; program published (sandbox only)
  if not exists (select 1 from public.rooms where venue_id = sb) then
    insert into public.rooms (venue_id, code, name, seats, level, step_free, sort) values
      (sb, 'A', 'Hall Ribat', 300, 'Ground floor', true, 1), (sb, 'B', 'Room Corniche', 80, 'First floor', true, 2), (sb, 'C', 'Room Marina', 60, 'First floor', true, 3);
  end if;
  select id into rm1 from public.rooms where venue_id = sb and code = 'A';
  select id into rm2 from public.rooms where venue_id = sb and code = 'B';
  select id into rm3 from public.rooms where venue_id = sb and code = 'C';
  if not exists (select 1 from public.sessions where venue_id = sb) then
    insert into public.sessions (venue_id, code, title, kind, room_id, starts_at, ends_at, chair_id) values
      (sb, 'K1', 'Keynote — Control in the age of learning', 'keynote', rm1, '2027-05-19 09:00+01', '2027-05-19 10:00+01', amara),
      (sb, 'WeA1', 'Marine and aerial robotics', 'oral', rm2, '2027-05-19 10:30+01', '2027-05-19 12:10+01', g),
      (sb, 'WeA2', 'Learning and estimation', 'oral', rm3, '2027-05-19 10:30+01', '2027-05-19 12:10+01', priya),
      (sb, 'ThA1', 'Robust control', 'oral', rm2, '2027-05-20 10:30+01', '2027-05-20 12:10+01', amara);
    select id into ses from public.sessions where venue_id = sb and code = 'WeA1';
    insert into public.session_talks (session_id, submission_id, title, position, starts_at, talk_min, qa_min, presenter_id)
    select ses, x.id, x.title, row_number() over (order by x.number), '2027-05-19 10:30+01'::timestamptz + (row_number() over (order by x.number) - 1) * interval '20 minutes', 15, 5, x.created_by
    from public.submissions x where x.venue_id = sb and x.number in (5, 6);
    select id into ses from public.sessions where venue_id = sb and code = 'ThA1';
    insert into public.session_talks (session_id, submission_id, title, position, starts_at, talk_min, qa_min, presenter_id)
    select ses, x.id, x.title, 1, '2027-05-20 10:30+01', 15, 5, g from public.submissions x where x.venue_id = sb and x.number = 10;
    insert into public.program_publications (venue_id, published_at, published_by) values (sb, now(), g);
  end if;

  -- sandbox registrations: Ghazi (paid) and a few attendees
  if not exists (select 1 from public.registrations where venue_id = sb) then
    insert into public.registrations (venue_id, person_id, number, reg_type, full_name, email, affiliation, covers_papers, paid_at, badges, source, status, payment_method,
      invoice_number, amount_cents, currency, items)
    select sb, p.id, 'PSC-' || lpad(row_number() over (order by p.display_name)::text, 4, '0'), 'Full', p.display_name, null,
           (select institution from public.affiliations where person_id = p.id limit 1), 1,
           case when p.id in (g, kenji, elena, chiara) then now() - interval '3 days' else null end, 1, 'manual',
           case when p.id in (g, kenji, elena, chiara) then 'confirmed' else 'awaiting_payment' end, 'invoice',
           'PSC-INV-' || lpad(row_number() over (order by p.display_name)::text, 4, '0'), 42000, 'EUR',
           '[{"qty":1,"kind":"ticket","name":"Full","unit_cents":42000}]'::jsonb
    from public.persons p where p.id in (g, kenji, elena, chiara, ingrid, wei, yuki);
  end if;
end $$;
