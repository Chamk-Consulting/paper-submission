-- Demo data for Ghazi Rabeh (PL-8574-7907) so the whole workspace has something to show.
-- Safe to run more than once. Applied to production on 2026-10-22.
do $$
declare
  g uuid := '8e630521-7567-4bed-bc5e-5723489cf00b';
  qa uuid := (select p.id from public.persons p join auth.users u on u.id = p.user_id where u.email = 'plenary.qa@example.com');
  pdc uuid := (select id from public.venues where slug = 'plenary-demo-2027');
  lbc uuid := (select id from public.venues where slug = 'plenary-demo-workshop-2027');
  pdj uuid := (select id from public.venues where slug = 'plenary-demo-journal');
  old uuid := (select id from public.venues where slug = 'plenary-demo-2025');
  s record;
begin
  -- roles
  insert into public.venue_members (venue_id, person_id, role, invited_by) values
    (pdc, g, 'owner', qa), (pdc, g, 'program_chair', qa), (pdc, g, 'reviewer', qa), (pdc, g, 'session_chair', qa),
    (lbc, g, 'program_chair', qa), (pdj, g, 'chair', qa), (pdj, g, 'reviewer', qa), (old, g, 'chair', qa)
  on conflict do nothing;

  -- papers: one per stage (author, corresponding, confirmed) + one co-authorship awaiting confirmation
  for s in select id, (id = '26eb05b2-5d81-7e9b-0cb6-544102e42af4'::uuid) as pending from public.submissions where id in (
    '25b44662-0472-9234-8521-1b3eb64af9d8', -- PDC #56 in review
    'abf57566-fa5d-4472-8508-6dc0c2019df9', -- PDC #27 revise
    'f971bd3d-d811-f2af-05c1-630a4f7f58ee', -- PDC #8 final version due
    '2ddbeb17-9b60-6a6d-c304-f5aeab191eea', -- PDC #59 decision
    '3697116b-604c-6a1e-d53e-d65a73524a4f', -- PDC #1 published
    '8c8171d3-e158-ccb0-e47a-4c62a9015df3', -- PDC #31 not accepted
    '191f93fa-4930-3c80-8cd1-0f93e9db5994', -- PDJ #101 in review
    '54329752-7c66-8310-8a40-8ede7347f2b4', -- workshop #1 submitted
    '05a7cb08-9ecc-ec76-d23b-6da6f9e36441', -- PDC 2025 #1 published (past event)
    '26eb05b2-5d81-7e9b-0cb6-544102e42af4'  -- PDJ #103 revise: co-author, confirmation pending
  ) loop
    if not exists (select 1 from public.submission_authors where submission_id = s.id and person_id = g) then
      insert into public.submission_authors (submission_id, person_id, position, is_corresponding, confirmation, responded_at, affiliation)
      values (s.id, g, (select coalesce(max(position), 0) + 1 from public.submission_authors where submission_id = s.id),
              not s.pending, case when s.pending then 'pending' else 'confirmed' end, case when s.pending then null else now() end,
              (select institution from public.affiliations where person_id = g order by ends_on nulls first limit 1));
    end if;
  end loop;

  -- reviewing: one accepted (due in about two weeks), one invitation waiting for an answer
  if not exists (select 1 from public.review_assignments where reviewer_id = g and submission_id = '31e56f56-997d-2e81-e055-697296091f56') then
    insert into public.review_assignments (submission_id, reviewer_id, round, ordinal, invited_by, status, reply_by, due_at, responded_at)
    values ('31e56f56-997d-2e81-e055-697296091f56', g, 1, 3, qa, 'accepted', now() - interval '3 days', now() + interval '14 days', now() - interval '4 days');
  end if;
  if not exists (select 1 from public.review_assignments where reviewer_id = g and submission_id = '94f8f63b-aa67-a437-9a23-12e52a629d72') then
    insert into public.review_assignments (submission_id, reviewer_id, round, ordinal, invited_by, status, reply_by, due_at)
    values ('94f8f63b-aa67-a437-9a23-12e52a629d72', g, 1, 1, qa, 'invited', now() + interval '7 days', now() + interval '21 days');
  end if;

  -- session co-chair at PDC 2027 (WeA2)
  update public.sessions set cochair_id = g where id = 'a5eee484-283e-797f-4a6a-d7c64a0dbcd3' and cochair_id is null;

  -- registration, paid
  if not exists (select 1 from public.registrations where venue_id = pdc and person_id = g) then
    insert into public.registrations (venue_id, person_id, number, reg_type, full_name, email, affiliation, covers_papers, paid_at, badges, source,
                                      status, payment_method, invoice_number, amount_cents, currency, items)
    values (pdc, g, 'REG-GR01', 'Full — IEEE member', 'Ghazi Rabeh', 'ghazirabeh9@gmail.com',
            (select institution from public.affiliations where person_id = g order by ends_on nulls first limit 1), 2, now() - interval '2 days', 1, 'manual',
            'confirmed', 'card', 'INV-GR01', 62000, 'EUR', '[{"qty":1,"kind":"ticket","name":"Full — IEEE member","unit_cents":62000}]'::jsonb);
  end if;

  -- reviewing profile
  insert into public.person_topics (person_id, topic) values
    (g, 'Robust control'), (g, 'Model predictive control'), (g, 'Marine systems'), (g, 'Learning-based control'), (g, 'Estimation and filtering')
  on conflict do nothing;
  update public.persons set review_languages = array['en', 'fr', 'ar'] where id = g and review_languages = '{}';
end $$;
