-- Plenary — 10 university conferences open for submissions, with no submission limit.
-- Supabase → SQL Editor → New query → paste everything → Run. Safe to run again (updates, never duplicates).
--
-- What it does
--   1. Adds 10 published university conferences (fictional universities, marked "sandbox") that accept papers
--      until 31 Dec 2030, so they stay open. Every conference has 3 paper types (full, short, abstract/poster).
--   2. No limit on papers: no per-author cap (max_papers_per_author = null), up to 60 + 20 pages,
--      single-blind (no anonymising needed), and the 10-drafts-per-venue safety cap is lifted for these venues only.
-- Needs: the Plenary install (parts 01–08) already run.

begin;

-- ---------------------------------------------------------------- 1. drafts: no cap for venues marked "unlimited"
create or replace function public.create_draft(p_venue uuid, p_paper_type text, p_track text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_person uuid := private.current_person_id();
  v_id uuid;
begin
  if v_person is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not private.venue_open(p_venue) then raise exception 'submissions are closed' using errcode = '22023'; end if;
  if coalesce(btrim(p_paper_type), '') = '' or char_length(p_paper_type) > 80 then raise exception 'choose a type' using errcode = '22023'; end if;
  if coalesce((select (v.details ->> 'unlimited')::boolean from public.venues v where v.id = p_venue), false) is not true
     and (select count(*) from public.submissions s join public.submission_authors a on a.submission_id = s.id
          where s.venue_id = p_venue and a.person_id = v_person and s.stage = 'draft') >= 10 then
    raise exception 'too many drafts at this venue' using errcode = '22023';
  end if;

  insert into public.submissions (venue_id, title, paper_type, track, stage, draft_step, created_by)
  values (p_venue, 'Untitled paper', btrim(p_paper_type), nullif(btrim(coalesce(p_track, '')), ''), 'draft', 2, v_person)
  returning id into v_id;
  insert into public.submission_authors (submission_id, person_id, position, is_corresponding)
  values (v_id, v_person, 1, true);
  insert into public.audit_log (actor_person_id, venue_id, action, entity, entity_id)
  values (v_person, p_venue, 'submission.draft_created', 'submission', v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------- 2. the 10 universities
create temporary table _uni (slug text, uni text, short text, theme text, field text, city text, country text, region text,
  tz text, lat numeric, lon numeric, accent text, topics text[]) on commit drop;
insert into _uni values
 ('northmere-oc-2027',   'Northmere University',                 'NMU-OC 2027',  'Robotics and Autonomous Systems',     'robotics', 'Manchester', 'United Kingdom', 'Europe',                 'Europe/London',        53.4808,  -2.2426, 'navy',    array['Mobile robots','Manipulation','Robot learning']),
 ('rheinau-tu-cc-2027',  'Rheinau Technical University',         'RTU-CC 2027',  'Control and Automation',              'control',  'Cologne',    'Germany',        'Europe',                 'Europe/Berlin',        50.9375,   6.9603, 'royal',   array['Robust control','Process automation','Optimal control']),
 ('garonne-ss-2027',     'Université de Garonne-Lumière',        'UGL-SS 2027',  'Systems Science and Engineering',     'systems',  'Toulouse',   'France',         'Europe',                 'Europe/Paris',         43.6047,   1.4442, 'teal',    array['Systems engineering','Networked systems','Verification']),
 ('adriano-rob-2027',    'Politecnico Adriano',                  'PA-ROB 2027',  'Medical and Service Robotics',        'robotics', 'Bologna',    'Italy',          'Europe',                 'Europe/Rome',          44.4949,  11.3426, 'crimson', array['Surgical robotics','Assistive robots','Human–robot interaction']),
 ('lakemont-ctl-2027',   'Lakemont State University',            'LSU-CTL 2027', 'Learning-Based Control',              'control',  'Chicago',    'United States',  'Americas',               'America/Chicago',      41.8781, -87.6298, 'saffron', array['Reinforcement learning','Safe learning','Data-driven control']),
 ('westhaven-ocean-2027','Westhaven Institute of Technology',    'WIT-OE 2027',  'Ocean Engineering and Marine Robotics','ocean',   'Vancouver',  'Canada',         'Americas',               'America/Vancouver',    49.2827,-123.1207, 'forest',  array['Underwater vehicles','Marine sensing','Offshore systems']),
 ('kaigan-ras-2027',     'Kaigan University of Technology',      'KUT-RAS 2027', 'Robotics and Automation Science',     'robotics', 'Osaka',      'Japan',          'Asia–Pacific',           'Asia/Tokyo',           34.6937, 135.5023, 'royal',   array['Humanoids','Field robotics','Multi-robot systems']),
 ('harbourline-mar-2027','Harbourline University',               'HU-MAR 2027',  'Marine Autonomy',                     'ocean',    'Sydney',     'Australia',      'Asia–Pacific',           'Australia/Sydney',    -33.8688, 151.2093, 'teal',    array['Autonomous ships','Ocean modelling','Coastal monitoring']),
 ('pharos-sys-2027',     'Pharos Technical University',          'PTU-SYS 2027', 'Cyber-Physical Systems',              'systems',  'Alexandria', 'Egypt',          'Africa & Middle East',   'Africa/Cairo',         31.2001,  29.9187, 'saffron', array['Cyber-physical systems','Smart grids','Embedded control']),
 ('kilima-ctl-2027',     'Kilima Highlands University',          'KHU-CTL 2027', 'Control for Energy and Agriculture',  'control',  'Nairobi',    'Kenya',          'Africa & Middle East',   'Africa/Nairobi',       -1.2921,  36.8219, 'forest',  array['Energy systems','Agricultural automation','Water networks']);

-- organiser shown on the venues: the sandbox chair (Helena Varga) when present
create temporary table _org on commit drop as
  select (select id from public.persons where given_name = 'Helena' and family_name = 'Varga' order by created_at limit 1) as person_id;

insert into public.venues (id, slug, name, short_name, kind, starts_on, ends_on, location, timezone, double_blind, is_published, created_by,
  field, format, review_mode, page_limit, accepting, city, country, region, latitude, longitude, place_hint, details, tagline, accent,
  public_text, contact_email, status, opened_at, imported_from, approved_at)
select md5('plenary-uni-' || u.slug)::uuid, u.slug,
  u.uni || ' Open Conference on ' || u.theme || ' 2027 (sandbox)', u.short, 'conference', '2027-09-13', '2027-09-16',
  u.city || ', ' || u.country, u.tz, false, true, o.person_id,
  u.field, 'hybrid', 'Single-blind', 'Up to 60 + 20 pp', 'Open all year — no limit on submissions (sandbox)',
  u.city, u.country, u.region, u.lat, u.lon, u.uni || ' campus',
  jsonb_build_object(
    'unlimited', true,
    'sandbox', 'Sandbox data for trying Plenary — the university and conference are fictional',
    'topics', to_jsonb(u.topics),
    'cfp', u.uni || ' (fictional) invites papers on ' || lower(u.theme) || '. Submissions stay open until 31 December 2030 and there is no limit on how many papers you submit — use it to try the whole author flow.',
    'types', jsonb_build_array(
      jsonb_build_object('name', 'Full paper', 'length', 'up to 60 pages', 'review', 'Single-blind'),
      jsonb_build_object('name', 'Short paper', 'length', 'up to 8 pages', 'review', 'Single-blind'),
      jsonb_build_object('name', 'Abstract or poster', 'length', 'up to 2 pages', 'review', 'Single-blind'))),
  'Open for submissions — no limit (sandbox)', u.accent,
  'Sandbox conference hosted by a fictional university. Submit as many papers as you like until 31 December 2030.',
  'conference@' || split_part(u.slug, '-', 1) || '.example', 'open', now(), 'sandbox', now()
from _uni u cross join _org o
on conflict (slug) do update set
  name = excluded.name, short_name = excluded.short_name, is_published = true, status = 'open', accepting = excluded.accepting,
  review_mode = excluded.review_mode, page_limit = excluded.page_limit, details = public.venues.details || excluded.details,
  tagline = excluded.tagline, public_text = excluded.public_text, approved_at = coalesce(public.venues.approved_at, now());

-- dates: open now, deadline 31 Dec 2030 (23:59 AoE) — the site counts the venue as open while a deadline is ahead
insert into public.venue_dates (id, venue_id, kind, label, starts_at, ends_at, is_hard, is_extended, key, note)
select md5('plenary-uni-date-' || d.k || u.slug)::uuid, v.id, d.kind::public.venue_date_kind, d.label, d.at, d.until, d.hard, false, d.k, d.note
from _uni u join public.venues v on v.slug = u.slug
cross join (values
  ('submissions_open', 'submission', 'Submissions open',          now(),                                  null::timestamptz,                       false, null),
  ('paper_deadline',   'submission', 'Paper submission deadline', '2030-12-31T23:59:00-12'::timestamptz,  null::timestamptz,                       true,  '23:59 AoE — no limit on papers'),
  ('decisions',        'notification','Notification',            '2031-02-15T09:00:00Z'::timestamptz,    null::timestamptz,                       true,  null),
  ('conference',       'conference', 'Conference',                '2027-09-13T09:00:00Z'::timestamptz,    '2027-09-16T17:00:00Z'::timestamptz,     true,  null)
) as d(k, kind, label, at, until, hard, note)
on conflict (id) do update set starts_at = excluded.starts_at, label = excluded.label, note = excluded.note;

-- paper types: generous page limits
insert into public.submission_types (id, venue_id, name, description, pages, extra_pages, extra_page_fee, revision_pages, deadline_at, blind_override, enabled, sort)
select md5('plenary-uni-type-' || t.name || u.slug)::uuid, v.id, t.name, t.descr, t.pages, t.extra, null, t.rev, null, null, true, t.sort
from _uni u join public.venues v on v.slug = u.slug
cross join (values
  ('Full paper',         'Full research paper — any length up to 60 pages',  60, 20, 80, 0),
  ('Short paper',        'Work in progress or focused result',                8,  0, 10, 1),
  ('Abstract or poster', 'Extended abstract presented as a poster',           2,  0, null, 2)
) as t(name, descr, pages, extra, rev, sort)
on conflict (venue_id, name) do update set pages = excluded.pages, extra_pages = excluded.extra_pages, enabled = true;

-- settings: no per-author cap, single-blind, no bidding or rebuttal to slow things down
update public.venue_settings s
set max_papers_per_author = null, blind_type = 'single', min_reviews = 1, max_reviewers = 3, bidding = false, rebuttal = false
from public.venues v join _uni u on u.slug = v.slug
where s.venue_id = v.id;

update public.venue_setup_sections s set status = 'ready', updated_at = now()
from public.venues v join _uni u on u.slug = v.slug
where s.venue_id = v.id;

-- organiser membership (sandbox chair), so each venue has an owner
insert into public.venue_members (venue_id, person_id, role)
select v.id, o.person_id, 'owner'::public.venue_role
from _uni u join public.venues v on v.slug = u.slug cross join _org o
where o.person_id is not null
on conflict do nothing;

commit;

-- Check: 10 rows, all open, deadline 2030
select v.short_name, v.city, v.country, private.venue_open(v.id) as open, private.venue_deadline(v.id) as deadline,
       (select count(*) from public.submission_types t where t.venue_id = v.id) as paper_types
from public.venues v where v.imported_from = 'sandbox' and (v.details ->> 'unlimited')::boolean
order by v.short_name;
