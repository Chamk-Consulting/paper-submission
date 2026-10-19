-- Attend slice: online attendee registration + invoices (RG01), badges with a QR check-in token (BD01),
-- public paper pages (PP01). Additive only.

-- ---------------------------------------------------------------- registrations: online orders, payment, badge token
alter table public.registrations drop constraint if exists registrations_source_check;
alter table public.registrations add constraint registrations_source_check check (source in ('manual', 'import', 'desk', 'online'));
alter table public.registrations
  add column if not exists status            text not null default 'confirmed' check (status in ('confirmed', 'awaiting_payment', 'cancelled')),
  add column if not exists payment_method    text check (payment_method in ('invoice', 'card', 'manual')),
  add column if not exists invoice_number    text check (char_length(invoice_number) <= 40),
  add column if not exists amount_cents      integer check (amount_cents >= 0),
  add column if not exists currency          text check (currency ~ '^[A-Z]{3}$'),
  add column if not exists items             jsonb not null default '[]'::jsonb,
  add column if not exists billing           jsonb not null default '{}'::jsonb,
  add column if not exists early_rate        boolean not null default false,
  add column if not exists stripe_session_id text check (char_length(stripe_session_id) <= 200),
  add column if not exists cancelled_at      timestamptz,
  add column if not exists checkin_salt      uuid not null default gen_random_uuid(),
  add column if not exists checkin_hash      text;
create unique index if not exists registrations_invoice_uq on public.registrations (venue_id, invoice_number) where invoice_number is not null;
create unique index if not exists registrations_checkin_uq on public.registrations (checkin_hash) where checkin_hash is not null;
create index if not exists registrations_stripe_idx on public.registrations (stripe_session_id) where stripe_session_id is not null;
create index if not exists registrations_person_idx on public.registrations (venue_id, person_id);

-- The badge QR carries a token derived from a per-registration salt; only its sha256 hash is looked up at the desk.
-- The app computes the same token (lib/attend/badge.ts) for the owner of the registration and for organizers.
create or replace function private.badge_token(p_id uuid, p_salt uuid)
returns text language sql immutable set search_path = '' as $$
  select left(encode(sha256(convert_to('plenary-badge:' || p_salt::text || ':' || p_id::text, 'UTF8')), 'hex'), 32)
$$;
create or replace function private.registrations_badge_hash()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.checkin_hash := encode(sha256(convert_to(private.badge_token(new.id, new.checkin_salt), 'UTF8')), 'hex');
  return new;
end $$;
drop trigger if exists registrations_badge_hash on public.registrations;
create trigger registrations_badge_hash before insert or update of checkin_salt on public.registrations
  for each row execute function private.registrations_badge_hash();
update public.registrations set checkin_hash = encode(sha256(convert_to(private.badge_token(id, checkin_salt), 'UTF8')), 'hex') where checkin_hash is null;

-- ---------------------------------------------------------------- helpers
-- fee_types items: {"name","early","late","covers"}; covers "n" = papers_per_registration, "0".."4" = that many, "-" = an extra.
create or replace function private.fee_cents(p_item jsonb, p_early boolean)
returns integer language sql immutable set search_path = '' as $$
  select case
    when p_early and jsonb_typeof(p_item->'early') = 'number' then round((p_item->>'early')::numeric * 100)::int
    when jsonb_typeof(p_item->'late') = 'number' then round((p_item->>'late')::numeric * 100)::int
    when jsonb_typeof(p_item->'early') = 'number' then round((p_item->>'early')::numeric * 100)::int
    else null end
$$;

create or replace function private.early_until(p_venue uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select min(d.starts_at) from public.venue_dates d where d.venue_id = p_venue and (d.key = 'registration' or d.kind::text = 'registration')
$$;

create or replace function private.fee_types(p_venue uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select st.fee_types from public.venue_settings st where st.venue_id = p_venue),
    '[{"name":"Full","early":null,"late":null,"covers":"n"},{"name":"Student","early":null,"late":null,"covers":"0"}]'::jsonb)
$$;

-- ---------------------------------------------------------------- RPC: what can I buy (RG01)
create or replace function public.registration_options(p_venue uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_ppr int;
  v_cur text;
  v_early timestamptz := private.early_until(p_venue);
  v_is_early boolean;
  v_fees jsonb := private.fee_types(p_venue);
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.venues v where v.id = p_venue and (v.is_published or private.is_organizer(p_venue))) then
    raise exception 'venue not found' using errcode = 'P0002';
  end if;
  select coalesce(st.papers_per_registration, 2), coalesce(st.currency, 'USD') into v_ppr, v_cur from public.venue_settings st where st.venue_id = p_venue;
  v_ppr := coalesce(v_ppr, 2); v_cur := coalesce(v_cur, 'USD');
  v_is_early := v_early is null or now() < v_early;
  return jsonb_build_object(
    'currency', v_cur,
    'early_until', v_early,
    'is_early', v_is_early,
    'papers_per_registration', v_ppr,
    'tickets', coalesce((select jsonb_agg(jsonb_build_object('index', o.n, 'name', o.f->>'name',
                 'covers', case o.f->>'covers' when 'n' then v_ppr else coalesce(nullif(o.f->>'covers', '')::int, 0) end,
                 'price_cents', private.fee_cents(o.f, v_is_early), 'early_cents', private.fee_cents(o.f, true),
                 'late_cents', case when jsonb_typeof(o.f->'late') = 'number' then round((o.f->>'late')::numeric * 100)::int else null end) order by o.n)
               from jsonb_array_elements(v_fees) with ordinality o(f, n) where coalesce(o.f->>'covers', 'n') <> '-'), '[]'::jsonb),
    'extras', coalesce((select jsonb_agg(jsonb_build_object('index', o.n, 'name', o.f->>'name', 'price_cents', private.fee_cents(o.f, v_is_early)) order by o.n)
               from jsonb_array_elements(v_fees) with ordinality o(f, n) where o.f->>'covers' = '-'), '[]'::jsonb),
    'papers', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'number', s.number, 'title', s.title, 'corresponding', a.is_corresponding,
                 'presenter', (select pp.display_name from public.session_talks t join public.persons pp on pp.id = t.presenter_id where t.submission_id = s.id limit 1),
                 'covered_by', (select g.number from public.registration_papers rp join public.registrations g on g.id = rp.registration_id
                                where rp.submission_id = s.id and g.status <> 'cancelled' limit 1)) order by s.number)
               from public.submissions s join public.submission_authors a on a.submission_id = s.id and a.person_id = v_me
               where s.venue_id = p_venue and s.stage::text in ('final', 'done')), '[]'::jsonb),
    'mine', (select jsonb_build_object('id', g.id, 'number', g.number, 'reg_type', g.reg_type, 'status', g.status, 'paid_at', g.paid_at,
                 'amount_cents', g.amount_cents, 'currency', g.currency, 'invoice_number', g.invoice_number, 'payment_method', g.payment_method,
                 'items', g.items, 'created_at', g.created_at, 'checked_in_at', g.checked_in_at,
                 'papers', coalesce((select jsonb_agg(s.number order by s.number) from public.registration_papers rp join public.submissions s on s.id = rp.submission_id
                                     where rp.registration_id = g.id), '[]'::jsonb))
             from public.registrations g where g.venue_id = p_venue and g.person_id = v_me and g.status <> 'cancelled'
             order by g.created_at desc limit 1),
    'me', (select jsonb_build_object('name', p.display_name,
                 'email', (select e.email::text from public.person_emails e where e.person_id = p.id order by e.is_primary desc, e.created_at limit 1),
                 'affiliation', (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1))
           from public.persons p where p.id = v_me)
  );
end $$;

-- ---------------------------------------------------------------- RPC: register (RG01)
-- p_ticket: the ticket's 1-based index in fee_types; p_extras: [{"index": n, "qty": q}]; p_method: invoice | card.
create or replace function public.register_attendee(p_venue uuid, p_ticket integer, p_papers uuid[], p_extras jsonb, p_billing jsonb, p_method text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_person_id();
  v_fees jsonb := private.fee_types(p_venue);
  v_ticket jsonb;
  v_ppr int;
  v_cur text;
  v_limit int;
  v_early boolean := private.early_until(p_venue) is null or now() < private.early_until(p_venue);
  v_amount int;
  v_items jsonb;
  v_x jsonb;
  v_extra jsonb;
  v_qty int;
  v_unit int;
  v_paper uuid;
  v_seq int;
  v_id uuid;
  v_number text;
  v_invoice text;
  v_name text;
  v_email text;
  v_aff text;
  v_billing jsonb;
begin
  if v_me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_method not in ('invoice', 'card') then raise exception 'bad payment method' using errcode = '22023'; end if;
  if not exists (select 1 from public.venues v where v.id = p_venue and v.is_published) then raise exception 'venue not found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtext('plenary-reg:' || p_venue::text));
  if exists (select 1 from public.registrations g where g.venue_id = p_venue and g.person_id = v_me and g.status <> 'cancelled') then
    raise exception 'already registered' using errcode = '23505';
  end if;

  v_ticket := v_fees -> (p_ticket - 1);
  if p_ticket is null or p_ticket < 1 or v_ticket is null or coalesce(v_ticket->>'covers', 'n') = '-' then raise exception 'choose a ticket' using errcode = '22023'; end if;
  select coalesce(st.papers_per_registration, 2), coalesce(st.currency, 'USD') into v_ppr, v_cur from public.venue_settings st where st.venue_id = p_venue;
  v_ppr := coalesce(v_ppr, 2); v_cur := coalesce(v_cur, 'USD');
  v_limit := case coalesce(v_ticket->>'covers', 'n') when 'n' then v_ppr else coalesce(nullif(v_ticket->>'covers', '')::int, 0) end;
  v_unit := private.fee_cents(v_ticket, v_early);
  if v_unit is null then raise exception 'price not set' using errcode = '22023'; end if;
  v_amount := v_unit;
  v_items := jsonb_build_array(jsonb_build_object('kind', 'ticket', 'name', v_ticket->>'name', 'qty', 1, 'unit_cents', v_unit));

  -- papers: own accepted papers of this venue, not covered by another registration
  if coalesce(cardinality(p_papers), 0) > v_limit then raise exception 'this ticket covers at most % paper(s)', v_limit using errcode = '22023'; end if;
  foreach v_paper in array coalesce(p_papers, '{}'::uuid[]) loop
    if not exists (select 1 from public.submissions s join public.submission_authors a on a.submission_id = s.id and a.person_id = v_me
                   where s.id = v_paper and s.venue_id = p_venue and s.stage::text in ('final', 'done')) then
      raise exception 'not your accepted paper' using errcode = '42501';
    end if;
    if exists (select 1 from public.registration_papers rp join public.registrations g on g.id = rp.registration_id
               where rp.submission_id = v_paper and g.status <> 'cancelled') then
      raise exception 'paper already covered by another registration' using errcode = '23505';
    end if;
  end loop;

  -- extras
  for v_x in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) loop
    v_qty := coalesce((v_x->>'qty')::int, 0);
    if v_qty = 0 then continue; end if;
    v_extra := v_fees -> ((v_x->>'index')::int - 1);
    if v_extra is null or v_extra->>'covers' <> '-' or v_qty < 0 or v_qty > 10 then raise exception 'bad extra' using errcode = '22023'; end if;
    v_unit := private.fee_cents(v_extra, v_early);
    if v_unit is null then raise exception 'price not set' using errcode = '22023'; end if;
    v_amount := v_amount + v_unit * v_qty;
    v_items := v_items || jsonb_build_array(jsonb_build_object('kind', 'extra', 'name', v_extra->>'name', 'qty', v_qty, 'unit_cents', v_unit));
  end loop;

  select p.display_name,
         (select e.email::text from public.person_emails e where e.person_id = p.id order by e.is_primary desc, e.created_at limit 1),
         (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1)
    into v_name, v_email, v_aff from public.persons p where p.id = v_me;
  v_billing := jsonb_strip_nulls(jsonb_build_object(
    'name', left(nullif(btrim(p_billing->>'name'), ''), 200), 'vat', left(nullif(btrim(p_billing->>'vat'), ''), 40),
    'address', left(nullif(btrim(p_billing->>'address'), ''), 400), 'po', left(nullif(btrim(p_billing->>'po'), ''), 60),
    'email', left(nullif(btrim(p_billing->>'email'), ''), 254)));

  v_seq := coalesce((select max(substring(g.number from '^REG-(\d+)$')::int) from public.registrations g where g.venue_id = p_venue), 0) + 1;
  v_number := 'REG-' || lpad(v_seq::text, 4, '0');
  v_invoice := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.registrations (venue_id, person_id, number, reg_type, full_name, email, affiliation, covers_papers, paid_at, source,
                                    status, payment_method, invoice_number, amount_cents, currency, items, billing, early_rate)
  values (p_venue, v_me, v_number, left(coalesce(v_ticket->>'name', 'Registration'), 80), left(v_name, 200), v_email, left(v_aff, 200), least(v_limit, 4),
          case when v_amount = 0 then now() end, 'online', case when v_amount = 0 then 'confirmed' else 'awaiting_payment' end,
          p_method, v_invoice, v_amount, v_cur, v_items, v_billing, v_early)
  returning id into v_id;
  insert into public.registration_papers (registration_id, submission_id) select v_id, x from unnest(coalesce(p_papers, '{}'::uuid[])) x;

  perform private.notify(array[v_me], 'venue', 'Registration ' || v_number || ' received',
    case when v_amount = 0 then 'You are registered.' else 'Your registration is reserved. It is confirmed when the payment arrives (invoice ' || v_invoice || ').' end,
    p_venue, null, 'View registration', '/venues/' || (select v.slug from public.venues v where v.id = p_venue) || '/register');
  return jsonb_build_object('id', v_id, 'number', v_number, 'invoice_number', v_invoice, 'amount_cents', v_amount, 'currency', v_cur,
                            'status', case when v_amount = 0 then 'confirmed' else 'awaiting_payment' end);
end $$;

-- the registrant cancels an unpaid order; papers become free for a co-author to cover
create or replace function public.cancel_registration(p_registration uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare g public.registrations;
begin
  select * into g from public.registrations where id = p_registration for update;
  if g.id is null or g.person_id is distinct from private.current_person_id() then raise exception 'not allowed' using errcode = '42501'; end if;
  if g.paid_at is not null or g.status <> 'awaiting_payment' then raise exception 'only unpaid registrations can be cancelled here — contact the organizers' using errcode = '22023'; end if;
  update public.registrations set status = 'cancelled', cancelled_at = now() where id = p_registration;
  delete from public.registration_papers where registration_id = p_registration;
end $$;

-- registration chairs mark a bank transfer as received (or undo it)
create or replace function public.set_registration_paid(p_registration uuid, p_paid boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare g public.registrations;
begin
  select * into g from public.registrations where id = p_registration for update;
  if g.id is null or not private.has_venue_role(g.venue_id, array['owner', 'chair', 'registration_chair']::public.venue_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if g.status = 'cancelled' then raise exception 'registration is cancelled' using errcode = '22023'; end if;
  update public.registrations set paid_at = case when p_paid then coalesce(paid_at, now()) end,
                                  status = case when p_paid then 'confirmed' else 'awaiting_payment' end
  where id = p_registration;
  if p_paid and g.person_id is not null and g.paid_at is null then
    perform private.notify(array[g.person_id], 'venue', 'Payment received for ' || g.number, 'Your registration is confirmed.', g.venue_id,
      null, 'View registration', '/venues/' || (select v.slug from public.venues v where v.id = g.venue_id) || '/register');
  end if;
end $$;

-- invoice / receipt PDF data: the registrant or an organizer
create or replace function public.registration_document(p_registration uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', g.id, 'number', g.number, 'invoice_number', g.invoice_number, 'reg_type', g.reg_type, 'full_name', g.full_name,
           'email', g.email::text, 'affiliation', g.affiliation, 'status', g.status, 'paid_at', g.paid_at, 'created_at', g.created_at,
           'amount_cents', g.amount_cents, 'currency', g.currency, 'items', g.items, 'billing', g.billing, 'payment_method', g.payment_method,
           'venue', coalesce(v.short_name, v.name), 'venue_name', v.name, 'location', coalesce(v.location, v.city), 'starts_on', v.starts_on, 'ends_on', v.ends_on,
           'papers', coalesce((select jsonb_agg(jsonb_build_object('number', s.number, 'title', s.title) order by s.number)
                               from public.registration_papers rp join public.submissions s on s.id = rp.submission_id where rp.registration_id = g.id), '[]'::jsonb))
  from public.registrations g join public.venues v on v.id = g.venue_id
  where g.id = p_registration and (g.person_id = private.current_person_id() or private.is_organizer(g.venue_id))
$$;

-- ---------------------------------------------------------------- RPC: badges (BD01)
-- role ribbon: staff > session chair > presenter > author > attendee
create or replace function private.badge_role(p_venue uuid, p_person uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_person is null then 'attendee'
    when exists (select 1 from public.venue_members m where m.venue_id = p_venue and m.person_id = p_person
                 and m.role in ('owner', 'chair', 'program_chair', 'deputy_chair', 'registration_chair', 'staff')) then 'staff'
    when exists (select 1 from public.sessions s where s.venue_id = p_venue and (s.chair_id = p_person or s.cochair_id = p_person)) then 'chair'
    when exists (select 1 from public.session_talks t join public.sessions s on s.id = t.session_id where s.venue_id = p_venue and t.presenter_id = p_person) then 'presenter'
    when exists (select 1 from public.submission_authors a join public.submissions x on x.id = a.submission_id
                 where x.venue_id = p_venue and a.person_id = p_person and x.stage::text in ('final', 'done')) then 'author'
    else 'attendee' end
$$;

create or replace function private.badge_json(g public.registrations)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', g.id, 'number', g.number, 'full_name', g.full_name, 'affiliation', g.affiliation, 'reg_type', g.reg_type,
           'salt', g.checkin_salt, 'paid', g.paid_at is not null, 'status', g.status, 'checked_in_at', g.checked_in_at,
           'plenary_id', (select p.plenary_id from public.persons p where p.id = g.person_id),
           'role', private.badge_role(g.venue_id, g.person_id))
$$;

create or replace function public.my_badge(p_venue uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.badge_json(g) from public.registrations g
  where g.venue_id = p_venue and g.person_id = private.current_person_id() and g.status <> 'cancelled'
  order by g.created_at desc limit 1
$$;

create or replace function public.badge_sheet(p_venue uuid)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_organizer(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select private.badge_json(g) from public.registrations g
    where g.venue_id = p_venue and g.status <> 'cancelled' order by g.full_name nulls last, g.number;
end $$;

-- lost badge: a new salt makes the old QR stop working
create or replace function public.reissue_badge(p_registration uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare g public.registrations;
begin
  select * into g from public.registrations where id = p_registration;
  if g.id is null or not (g.person_id = private.current_person_id() or private.is_organizer(g.venue_id)) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.registrations set checkin_salt = gen_random_uuid() where id = p_registration;
end $$;

-- the desk scans a badge: p_hash = sha256(token). Unpaid registrations need p_force to be checked in.
create or replace function public.check_in_by_token(p_venue uuid, p_hash text, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.registrations;
  v_talk jsonb;
begin
  if not private.is_organizer(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into g from public.registrations where venue_id = p_venue and checkin_hash = p_hash and status <> 'cancelled' for update;
  if g.id is null then return jsonb_build_object('result', 'not_found'); end if;
  select jsonb_build_object('number', x.number, 'code', s.code, 'starts_at', coalesce(t.starts_at, s.starts_at), 'room', r.name) into v_talk
    from public.session_talks t join public.sessions s on s.id = t.session_id left join public.rooms r on r.id = s.room_id
    left join public.submissions x on x.id = t.submission_id
    where s.venue_id = p_venue and t.presenter_id = g.person_id order by coalesce(t.starts_at, s.starts_at) limit 1;
  if g.checked_in_at is not null then
    return jsonb_build_object('result', 'already', 'id', g.id, 'at', g.checked_in_at, 'number', g.number, 'full_name', g.full_name,
                              'reg_type', g.reg_type, 'affiliation', g.affiliation, 'talk', v_talk);
  end if;
  if g.paid_at is null and not coalesce(p_force, false) then
    return jsonb_build_object('result', 'unpaid', 'id', g.id, 'number', g.number, 'full_name', g.full_name, 'reg_type', g.reg_type,
                              'affiliation', g.affiliation, 'amount_cents', g.amount_cents, 'currency', g.currency);
  end if;
  update public.registrations set checked_in_at = now(), badges = badges + 1 where id = g.id;
  return jsonb_build_object('result', 'ok', 'id', g.id, 'number', g.number, 'full_name', g.full_name, 'reg_type', g.reg_type,
                            'affiliation', g.affiliation, 'talk', v_talk, 'paid', g.paid_at is not null);
end $$;

-- ---------------------------------------------------------------- RPC: public paper page (PP01)
create or replace function public.program_paper(p_venue uuid, p_number integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', x.id, 'number', x.number, 'title', x.title, 'abstract', x.abstract, 'keywords', to_jsonb(coalesce(x.keywords, '{}'::text[])),
           'paper_type', x.paper_type,
           'authors', coalesce((select jsonb_agg(jsonb_build_object('name', p.display_name,
                         'affiliation', (select f.institution from public.affiliations f where f.person_id = p.id and f.ends_on is null order by f.created_at desc limit 1))
                         order by a.position)
                       from public.submission_authors a join public.persons p on p.id = a.person_id where a.submission_id = x.id), '[]'::jsonb),
           'talk', jsonb_build_object('session_id', s.id, 'code', s.code, 'session_title', s.title, 'kind', s.kind, 'starts_at', coalesce(t.starts_at, s.starts_at),
                         'session_starts_at', s.starts_at, 'session_ends_at', s.ends_at, 'talk_min', t.talk_min, 'room', r.name,
                         'presenter', pp.display_name, 'remote', t.is_remote, 'has_slides', t.slides_path is not null),
           'saved', exists (select 1 from public.schedule_items i where i.session_id = s.id and i.person_id = private.current_person_id()))
  from public.session_talks t
  join public.sessions s on s.id = t.session_id
  join public.submissions x on x.id = t.submission_id
  left join public.rooms r on r.id = s.room_id
  left join public.persons pp on pp.id = t.presenter_id
  where s.venue_id = p_venue and x.number = p_number and x.venue_id = p_venue
    and (private.program_published(p_venue) or private.is_organizer(p_venue))
  order by s.starts_at limit 1
$$;

-- slides of talks in a published program are public (the paper page and session page link them)
create or replace function public.slides_are_public(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.session_talks t join public.sessions s on s.id = t.session_id
                 where t.slides_path = p_path and private.program_published(s.venue_id))
$$;
drop policy if exists papers_select_published_slides on storage.objects;
create policy papers_select_published_slides on storage.objects for select to anon, authenticated
  using (bucket_id = 'papers' and (select public.slides_are_public(storage.objects.name)));

create or replace function public.paper_slides_path(p_venue uuid, p_number integer)
returns text language sql stable security definer set search_path = '' as $$
  select t.slides_path from public.session_talks t join public.sessions s on s.id = t.session_id join public.submissions x on x.id = t.submission_id
  where s.venue_id = p_venue and x.number = p_number and t.slides_path is not null and private.program_published(p_venue) limit 1
$$;

-- ---------------------------------------------------------------- grants
revoke all on function private.badge_token(uuid, uuid), private.registrations_badge_hash(), private.fee_cents(jsonb, boolean), private.early_until(uuid),
  private.fee_types(uuid), private.badge_role(uuid, uuid), private.badge_json(public.registrations) from public, anon, authenticated;
revoke all on function public.registration_options(uuid), public.register_attendee(uuid, integer, uuid[], jsonb, jsonb, text), public.cancel_registration(uuid),
  public.set_registration_paid(uuid, boolean), public.registration_document(uuid), public.my_badge(uuid), public.badge_sheet(uuid), public.reissue_badge(uuid),
  public.check_in_by_token(uuid, text, boolean), public.program_paper(uuid, integer), public.slides_are_public(text), public.paper_slides_path(uuid, integer) from public, anon;
grant execute on function public.registration_options(uuid), public.register_attendee(uuid, integer, uuid[], jsonb, jsonb, text), public.cancel_registration(uuid),
  public.set_registration_paid(uuid, boolean), public.registration_document(uuid), public.my_badge(uuid), public.badge_sheet(uuid), public.reissue_badge(uuid),
  public.check_in_by_token(uuid, text, boolean) to authenticated;
grant execute on function public.program_paper(uuid, integer), public.slides_are_public(text), public.paper_slides_path(uuid, integer) to anon, authenticated;
