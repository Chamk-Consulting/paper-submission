-- DEMO DATA for the staging project only. Fictional placeholder venues (names in [brackets]) so the
-- directory, calendar, map and venue page have something to show. Dates are relative to now().
-- Safe to re-run: removes previous demo rows first (slugs start with "demo-").
begin;
delete from public.venues where slug like 'demo-%';

with v(slug, short_name, name, kind, society, field, format, review_mode, page_limit, indexed_in, accepting,
       city, country, region, lat, lng, hint, starts, ends) as (values
  ('demo-ca-2027','[CA] 2027','[Conference A] on Control and Automation','conference','IEEE CSS','control','in_person','Double-blind','6 + 2 pp',array['IEEE Xplore','Scopus'],'Full papers, invited sessions, workshops','[City]','[Country]','Europe',50.85,4.35,'Brussels area', now()::date+240, now()::date+243),
  ('demo-sb-2027','[SB] 2027','[Symposium B] on Robotic Systems','conference','IEEE RAS','robotics','hybrid','Single-blind','8 pp',array['IEEE Xplore'],'Regular and position papers','[City]','[Country]','Asia–Pacific',35.7,139.7,'Tokyo area', now()::date+200, now()::date+203),
  ('demo-cc-2027','[CC] 2027','[Conference C] — IFAC Congress','conference','IFAC','control','in_person','Single-blind','6 pp',array['Scopus'],'Contributed papers, open invited tracks','[City]','[Country]','Asia–Pacific',34.7,113.6,'Central China', now()::date+265, now()::date+270),
  ('demo-ec-2027','[EC] 2027','[European Control Conference]','conference','EUCA','systems','in_person','Single-blind','6 pp',array['IEEE Xplore'],'Regular papers, tutorials','[City]','[Country]','Europe',39.57,2.65,'Balearic Islands', now()::date+272, now()::date+275),
  ('demo-oc-2027','[OC] 2027','[Oceans Conference]','conference','IEEE OES','ocean','hybrid','Single-blind','4–8 pp',array['IEEE Xplore'],'Papers, student posters','[City]','[Country]','Americas',36.6,-121.9,'California coast', now()::date+340, now()::date+343),
  ('demo-ic-2026','[IC] 2026','[International Conference on System Theory]','conference','IEEE CSS','systems','in_person','Single-blind','6 pp',array['IEEE Xplore'],'Submissions closed','[City]','[Country]','Europe',47.2,27.6,'North-east Romania', now()::date-1, now()::date+2),
  ('demo-icc-2027','[ICC] 2027','[Indian Control Conference]','conference','IEEE CSS','control','in_person','Single-blind','6 pp',array['IEEE Xplore'],'Regular papers','[City]','[Country]','Asia–Pacific',22.3,87.3,'West Bengal', now()::date+90, now()::date+92),
  ('demo-icuas-2027','[ICUAS] 2027','[Conference on Unmanned Aircraft Systems]','conference','IEEE RAS','robotics','in_person','Single-blind','8 pp',array['IEEE Xplore'],'Papers, workshops','[City]','[Country]','Americas',-3.7,-38.5,'North-east Brazil', now()::date+240, now()::date+243),
  ('demo-africon-2027','[AFRICON] 2027','[IEEE Africa Conference]','conference','IEEE R8','systems','hybrid','Double-blind','6 pp',array['IEEE Xplore'],'Full papers, special sessions','[City]','[Country]','Africa & Middle East',-33.9,18.4,'Western Cape', now()::date+320, now()::date+323),
  ('demo-jd','[Journal D]','[Journal of Oceanic Engineering]','journal','IEEE OES','ocean','online','Single-blind','No limit',array['IEEE Xplore','Scopus','Web of Science'],'Research articles, technical notes',null,null,'Online',null,null,null, null, null),
  ('demo-awards-2027','[EUCA Awards] 2027','Nominations for awards','award','EUCA','systems','online','Committee','—',array[]::text[],'Nominations',null,null,'Online',null,null,null, now()::date+270, now()::date+270)
)
insert into public.venues (slug, short_name, name, kind, society, field, format, review_mode, page_limit, indexed_in, accepting,
  city, country, region, latitude, longitude, place_hint, starts_on, ends_on, timezone, double_blind, is_published, location, details)
select slug, short_name, name, kind::public.venue_kind, society, field, format::public.venue_format, review_mode, page_limit, indexed_in, accepting,
  city, country, region, lat, lng, hint, starts, ends, 'UTC', review_mode = 'Double-blind', true,
  case when city is null then 'Online' else city || ', ' || country end,
  jsonb_build_object(
    'cfp', name || ' brings together researchers and engineers working on the theory and practice of the field. [Two or three sentences from the organizers.]',
    'topics', jsonb_build_array('Adaptive and robust control','Learning-enabled control','Optimisation and MPC','Networked and multi-agent systems','Estimation and filtering','Energy and climate systems','Robotics and autonomy','Marine and aerospace systems'),
    'types', jsonb_build_array(
      jsonb_build_object('name','Regular paper','note','Full paper, oral or poster','length', page_limit,'review', review_mode || ' · 3 reviews'),
      jsonb_build_object('name','Invited session paper','note','Needs the code from your session organiser','length', page_limit,'review','Single-blind · 2 reviews'),
      jsonb_build_object('name','Workshop or tutorial','note','Half or full day, before the conference','length','4 pp proposal','review','Workshop chairs')),
    'policies', jsonb_build_array(
      jsonb_build_object('title','Length and fees','text','Pages beyond the limit are returned without review.'),
      jsonb_build_object('title','Dual submission and preprints','text','Papers under review elsewhere are rejected. Preprints on arXiv are allowed — don’t cite or link them in the submission.'),
      jsonb_build_object('title','Use of AI tools','tag','NEW','text','AI help with language is fine; disclose any AI-generated content in the acknowledgements. Reviewers: don’t upload papers to outside AI tools.'),
      jsonb_build_object('title','Anonymity','text','No names, affiliations or grant numbers in the PDF or file properties.')),
    'publication', jsonb_build_object('proceedings','Published by [Publisher] · each paper gets a DOI','copyright','Copyright form signed from your paper page after acceptance.'),
    'organizers', jsonb_build_array(
      jsonb_build_object('role','General chair','name','[Prof. Name]','org','[University]','topic','General questions'),
      jsonb_build_object('role','Program chair','name','[Prof. Name]','org','[University]','topic','Submissions and reviews')),
    'website', null)
from v;

-- Dated milestones (deadlines at 23:59 AoE = 11:59 UTC next day).
insert into public.venue_dates (venue_id, kind, label, starts_at, ends_at, is_hard, is_extended, extended_from)
select v.id, d.kind::public.venue_date_kind, d.label,
       (now()::date + d.days)::timestamptz + interval '11 hours 59 minutes',
       case when d.span is null then null else (now()::date + d.days + d.span)::timestamptz end,
       d.hard, d.ext, case when d.ext then (now()::date + d.days - 7)::timestamptz + interval '11 hours 59 minutes' end
from public.venues v
join (values
  ('demo-ca-2027','submission','Full papers close',4,null::int,true,true),
  ('demo-ca-2027','proposal','Workshop and tutorial proposals',58,null,true,false),
  ('demo-ca-2027','notification','Notification of acceptance',125,null,false,false),
  ('demo-ca-2027','final','Final version, copyright and registration',153,null,true,false),
  ('demo-sb-2027','submission','Papers close',6,null,true,false),
  ('demo-sb-2027','notification','Notification of acceptance',34,null,false,false),
  ('demo-cc-2027','proposal','Open invited track proposals',9,null,true,false),
  ('demo-cc-2027','submission','Contributed papers close',21,null,true,false),
  ('demo-ec-2027','proposal','Workshop and tutorial proposals',17,null,true,false),
  ('demo-ec-2027','submission','Regular papers close',28,null,true,false),
  ('demo-oc-2027','submission','Abstracts close',12,null,true,false),
  ('demo-icc-2027','submission','Papers close',45,null,true,false),
  ('demo-icuas-2027','submission','Papers close',110,null,true,false),
  ('demo-africon-2027','submission','Papers close',35,null,true,false),
  ('demo-awards-2027','submission','Award nominations close',44,null,true,false),
  ('demo-jd','notification','Special issue decisions',13,null,false,false),
  ('demo-ic-2026','conference','Conference',-1,3,true,false)
) as d(slug, kind, label, days, span, hard, ext) on d.slug = v.slug;

-- Conference dates for every dated venue.
insert into public.venue_dates (venue_id, kind, label, starts_at, ends_at)
select id, 'conference', 'Conference', starts_on::timestamptz, (ends_on + 1)::timestamptz
from public.venues where slug like 'demo-%' and starts_on is not null and kind = 'conference' and slug <> 'demo-ic-2026';

-- Past editions (Past venues tab).
insert into public.venues (slug, short_name, name, kind, society, field, format, region, city, country, starts_on, ends_on,
  is_published, papers_count, acceptance_rate, best_paper, imported_from, location)
values
  ('demo-ca-2026','[CA] 2026','[Conference A] on Control and Automation','conference','IEEE CSS','control','in_person','Europe','[City]','[Country]', now()::date-130, now()::date-127, true, 1240, 38, '[Distributed MPC for power networks]', null, '[City], [Country]'),
  ('demo-sb-2026','[SB] 2026','[Symposium B] on Robotic Systems','conference','IEEE RAS','robotics','hybrid','Asia–Pacific','[City]','[Country]', now()::date-165, now()::date-162, true, 610, 44, '[Legged locomotion on soft terrain]', null, '[City], [Country]'),
  ('demo-ca-2025','[CA] 2025','[Conference A] on Control and Automation','conference','IEEE CSS','control','in_person','Europe','[City]','[Country]', now()::date-495, now()::date-492, true, 1180, 40, '[Safe learning-based control]', null, '[City], [Country]'),
  ('demo-ec-2025','[EC] 2025','[European Control Conference]','conference','EUCA','systems','in_person','Europe','[City]','[Country]', now()::date-460, now()::date-457, true, 890, 52, '[Event-triggered estimation]', null, '[City], [Country]'),
  ('demo-ca-2024','[CA] 2024','[Conference A] on Control and Automation','conference','IEEE CSS','control','in_person','Europe','[City]','[Country]', now()::date-860, now()::date-857, true, 1105, 41, '[Robust adaptive observers]', 'PaperCept', '[City], [Country]'),
  ('demo-oc-2024','[OC] 2024','[Oceans Conference]','conference','IEEE OES','ocean','hybrid','Americas','[City]','[Country]', now()::date-760, now()::date-757, true, 720, 61, '[AUV docking in currents]', 'PaperCept', '[City], [Country]');
commit;
