-- CoDIT 2027: submission types and windows from the PaperCept submission wizard (27 Oct 2026), the rest from codit2027.com.
-- PaperCept deadlines are 23:59:59 Pacific Time; codit2027.com says Anywhere on Earth. Stored as Pacific Time (where papers are submitted).
-- NOT YET APPLIED: waiting for approval in the session of 27 Oct 2026.
do $$
declare v uuid := 'b45f99c5-a7cb-4660-b7e1-2cc13272c47f';
begin
  update public.submission_types set name = 'Regular paper', sort = 0, pages = 6, extra_pages = 2, extra_page_fee = 80, enabled = true,
    description = 'Contributed paper on completed research: up to 6 pages, IEEE two-column format (10-pt Times). Up to 2 extra pages at €80 each.',
    deadline_at = '2027-02-03T07:59:59Z'
  where id = '55e40465-70b3-46b9-9848-4bf5b69e4c35';
  update public.submission_types set name = 'Special session paper', sort = 1, pages = 6, extra_pages = 2, extra_page_fee = 80, enabled = true,
    description = 'Paper for an accepted special session: up to 6 pages, IEEE two-column format. Reviewed like regular papers, so acceptance is not guaranteed.',
    deadline_at = '2027-02-03T07:59:59Z'
  where id = '0282f4e0-8f21-4027-a84d-3f094c95df9f';
  update public.submissions set paper_type = 'Special session paper' where venue_id = v and paper_type = 'Invited session paper';
  update public.submission_types set name = 'Special session proposal', sort = 2, pages = 4, extra_pages = 0, extra_page_fee = null, enabled = true,
    description = 'Title, short scope and the organizers'' names and affiliations, on the CoDIT Word form saved as PDF. A special session has 5–6 papers; a special track has at least two sessions.',
    deadline_at = '2026-12-01T07:59:59Z'
  where id = 'c6f4cf17-0c9b-4b9e-9485-58773a0626df';
  update public.submissions set paper_type = 'Special session proposal' where venue_id = v and paper_type = 'Invited session proposal';
  update public.submission_types set enabled = false, sort = 9 where id = '8fba73d4-f9f6-46f0-b4b5-a64665659401';
  insert into public.submission_types (venue_id, name, description, pages, extra_pages, extra_page_fee, deadline_at, blind_override, enabled, sort)
  select v, 'Work-in-progress paper', 'Short paper: up to 5 pages, IEEE two-column format, at most 8 references. Presented in a 10-minute talk.',
         5, 0, null, '2027-04-28T06:59:59Z', 'single', true, 3
  where not exists (select 1 from public.submission_types where venue_id = v and name = 'Work-in-progress paper');

  delete from public.venue_dates where venue_id = v and kind <> 'conference';
  insert into public.venue_dates (venue_id, kind, label, starts_at, note) values
    (v, 'other', 'Submission site opens', '2026-10-16T07:00:00Z', 'Opened 16 October 2026 at 00:00 Pacific Time.'),
    (v, 'proposal', 'Special session proposals', '2026-12-01T07:59:59Z', '30 November 2026, 23:59:59 Pacific Time.'),
    (v, 'submission', 'Paper submission deadline', '2027-02-03T07:59:59Z', '2 February 2027, 23:59:59 Pacific Time. Regular and special session papers.'),
    (v, 'other', 'Work-in-progress papers', '2027-04-28T06:59:59Z', '27 April 2027, 23:59:59 Pacific Time.'),
    (v, 'notification', 'Acceptance notification', '2027-04-28T06:59:59Z', '27 April 2027.'),
    (v, 'final', 'Final version due', '2027-05-23T06:59:59Z', 'Final versions open 27 April 2027 and close 22 May 2027, 23:59:59 Pacific Time, for regular, special session and work-in-progress papers.'),
    (v, 'registration', 'Author registration deadline', '2027-05-23T06:59:59Z', '22 May 2027. One author per accepted paper.');
  update public.venue_dates set label = 'Conference (hybrid)', starts_at = '2027-07-08T07:00:00Z', ends_at = '2027-07-11T16:00:00Z'
  where venue_id = v and kind = 'conference';

  update public.venues set
    name = '2027 13th International Conference on Control, Decision and Information Technologies (CoDIT)',
    tagline = '13th edition · hybrid',
    location = 'Palma de Mallorca, Spain',
    city = 'Palma de Mallorca',
    format = 'hybrid',
    page_limit = 6,
    venue_address = 'Palau de Congressos de Palma, Carrer de Felicià Fuster 4, 07006 Palma de Mallorca, Spain',
    hotels = 'Meliá Palma Bay (connected to the congress centre; 20% off when booked 90+ days ahead, 15% for 15–89 days, 10% under 15 days, with the CoDIT booking link)',
    latitude = 39.5636, longitude = 2.6696,
    website = 'https://codit2027.com/',
    public_text = '13th edition of an international forum where researchers, academics and industry professionals present recent advances in control, decision and information technologies, in three tracks: control and automation; decision, optimization and cybernetics; artificial intelligence and information technologies. Hybrid, in Palma de Mallorca. The 2026 edition in Bari received 1,080 papers and more than 600 participants.',
    details = details || jsonb_build_object(
      'cfp', E'CoDIT 2027 welcomes original contributions in all areas of control, decision and information technologies, in three tracks:\n\n1. Control & Automation — control theory and design, robotics, autonomous and unmanned vehicles, fault detection and fault-tolerant control, predictive and robust control, cyber-physical and networked systems.\n2. Decision, Optimization & Cybernetics — decision support, operational research, multi-objective and stochastic optimization, scheduling, logistics and supply chains, forecasting, risk and reliability.\n3. Artificial Intelligence & Information Technologies — machine and deep learning, computer vision, natural language processing, generative AI, cybersecurity, cloud and edge computing, IoT, smart grids.\n\nApplication fields include aerospace, healthcare, industrial processes, Industry 4.0 and 5.0, renewable energy, smart cities, transportation and water management. Theoretical and methodological studies are welcome.\n\nPapers are in English and describe original work: regular papers up to 6 pages and work-in-progress papers up to 5 pages (at most 8 references), IEEE two-column format, 10-pt Times. Registered and presented papers are submitted to IEEE Xplore and other abstracting and indexing databases.',
      'topics', jsonb_build_array('Control and automation', 'Robotics and autonomous vehicles', 'Fault detection and fault-tolerant control', 'Predictive and robust control', 'Cyber-physical and networked systems', 'Decision support and operational research', 'Multi-objective and stochastic optimization', 'Scheduling, logistics and supply chains', 'Forecasting, risk and reliability', 'Machine learning and deep learning', 'Computer vision and NLP', 'Generative AI', 'Cybersecurity', 'Cloud, edge computing and IoT', 'Energy and smart grids', 'Healthcare', 'Industry 4.0 and 5.0', 'Smart cities and transportation', 'Aerospace', 'Water management'),
      'tracks', jsonb_build_array('Control & Automation', 'Decision, Optimization & Cybernetics', 'Artificial Intelligence & Information Technologies'),
      'program', jsonb_build_array('Keynote lectures', 'Regular and special sessions', 'Work-in-progress sessions (10-minute talks)', 'Workshops', 'Tutorials', 'Networking events', 'Women in Engineering (WiE)'),
      'publication', jsonb_build_object('proceedings', 'Registered and presented regular, special session and work-in-progress papers are submitted to IEEE Xplore and other abstracting and indexing databases. Past CoDIT proceedings are in IEEE Xplore.'),
      'source', 'https://codit2027.com/',
      'source_checked', '2026-10-27'),
    updated_at = now()
  where id = v;

  update public.venues set details = jsonb_set(details, '{policies}', (
    select jsonb_agg(case
      when p->>'title' = 'Registration and presentation' then jsonb_build_object('tag', 'No-show rule', 'title', 'Registration and presentation',
        'text', 'Each accepted paper needs a registered author by 22 May 2027 and must be presented at the conference by one of its authors to appear in IEEE Xplore. A Regular registration covers up to two accepted papers (the second is €300); Student and Virtual registrations cover one. At most one extra paper per registration and two extra pages per paper (€80 a page). Fees are not refunded within 30 days of the conference.')
      when p->>'title' = 'Author names on the PDF' then jsonb_build_object('title', 'Review', 'text', 'Papers are refereed in a blind process for technical merit and content. Special session papers get the same review as regular papers.')
      else p end) from jsonb_array_elements(details->'policies') p))
  where id = v;

  update public.venues set public_info = jsonb_set(jsonb_set(public_info,
      '{travel,address}', to_jsonb('Palau de Congressos de Palma, Carrer de Felicià Fuster 4, 07006 Palma de Mallorca'::text)),
      '{travel,summary}', to_jsonb('On the seafront of Palma, Mallorca. The Meliá Palma Bay hotel is connected to the congress centre. Palma de Mallorca Airport (PMI) has direct flights to most European cities.'::text))
  where id = v;
  update public.venues set public_info = jsonb_set(public_info, '{attending,registration_note}',
      to_jsonb('Fees in euros, paid online by card. Early rates until the date the organizers announce in May 2027. Regular includes all sessions, coffee breaks, two lunches, the banquet, receptions and the proceedings; Student includes sessions, coffee breaks, receptions and the proceedings; Virtual is online access to all sessions.'::text))
  where id = v;

  update public.venue_settings set fee_types = '[
      {"name": "Regular", "early": 720, "late": 840, "covers": "n"},
      {"name": "Regular, IEEE member", "early": 700, "late": 820, "covers": "n"},
      {"name": "Student", "early": 440, "late": 540, "covers": "1"},
      {"name": "Virtual", "early": 400, "late": 500, "covers": "1"},
      {"name": "Additional paper (max. 1 per registration)", "early": 300, "late": 300, "covers": "-"},
      {"name": "Extra page (max. 2 per paper)", "early": 80, "late": 80, "covers": "-"},
      {"name": "Additional banquet ticket", "early": 130, "late": 130, "covers": "-"}
    ]'::jsonb, papers_per_registration = 2, allow_remote = true, updated_at = now()
  where venue_id = v;
end $$;
