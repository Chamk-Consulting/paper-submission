-- Profile › Reviewing tab: languages a person can review papers in (several allowed). Readable like other profile
-- fields (chairs matching reviewers to papers in other languages); only the owner can change it.
alter table public.persons
  add column if not exists review_languages text[] not null default '{}'
    check (cardinality(review_languages) <= 10);
grant select (review_languages) on public.persons to authenticated;
grant update (review_languages) on public.persons to authenticated;
