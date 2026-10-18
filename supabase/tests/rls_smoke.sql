-- RLS smoke test for core identity. Runs in a transaction and ROLLS BACK (leaves no data).
-- Run: supabase test db  (local)  or paste into the SQL editor on staging.
begin;
insert into public.persons (id, given_name, family_name) values ('00000000-0000-0000-0000-0000000000cc','Placeholder','Coauthor');
insert into public.person_emails (person_id, email, is_primary) values ('00000000-0000-0000-0000-0000000000cc','co@uni.edu',true);
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','alice@uni.edu', now(), '{"given_name":"Alice","family_name":"Chair"}', now(), now()),
       ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','bob@lab.org', now(), '{"given_name":"Bob","family_name":"Author"}', now(), now()),
       ('00000000-0000-0000-0000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','co@uni.edu', null, '{}', now(), now());

create temp table results(test text, ok boolean) on commit drop;
grant all on results to authenticated, anon;

insert into results select 'unconfirmed signup does NOT claim placeholder', (select user_id is null from public.persons where id='00000000-0000-0000-0000-0000000000cc');
insert into results select 'confirmed users get a person', (select count(*)=2 from public.persons where user_id is not null);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}',true);
insert into public.venues (slug,name,created_by) values ('ifac-test-2027','IFAC Test 2027',(select private.current_person_id()));
insert into results select 'creator becomes owner', exists(select 1 from public.venue_members where role='owner');
insert into results select 'owner sees unpublished venue', (select count(*)=1 from public.venues);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}',true);
insert into results select 'outsider cannot see unpublished venue', (select count(*)=0 from public.venues);
insert into results select 'outsider sees only own email', (select count(*)=1 from public.person_emails);
insert into results select 'outsider cannot see private persons', (select count(*)=1 from public.persons);
do $$ begin
  begin
    update public.persons set orcid='0000-0002-1825-0097';
    insert into results values ('cannot set orcid directly', false);
  exception when insufficient_privilege then insert into results values ('cannot set orcid directly', true); end;
end $$;
update public.persons set given_name='Robert';
insert into results select 'can edit own name', (select given_name='Robert' from public.persons where user_id=auth.uid());

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
insert into results select 'anon sees no unpublished venues', (select count(*)=0 from public.venues);
do $$ begin
  begin perform 1 from public.persons; insert into results values ('anon blocked from persons', false);
  exception when insufficient_privilege then insert into results values ('anon blocked from persons', true); end;
end $$;

reset role;
update auth.users set email_confirmed_at = now() where id='00000000-0000-0000-0000-00000000000e';
insert into results select 'confirmed email claims placeholder', (select user_id='00000000-0000-0000-0000-00000000000e' from public.persons where id='00000000-0000-0000-0000-0000000000cc');
insert into results select 'no duplicate person created', (select count(*)=3 from public.persons);

select * from results;
rollback;
