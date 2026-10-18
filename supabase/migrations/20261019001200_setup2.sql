-- Setup part 2 (EM08 committee, EM40 people, EM44 audit): revoke an invitation, log exports and "view as".

create or replace function public.revoke_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.invitations;
begin
  select * into i from public.invitations where id = p_invitation for update;
  if i.id is null or not private.has_venue_role(i.venue_id, array['owner', 'chair', 'program_chair']::public.venue_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if i.status = 'pending' then
    update public.invitations set status = 'revoked', responded_at = now() where id = i.id;
    perform private.log(i.venue_id, 'role.invitation_revoked', 'invitation', i.id, jsonb_build_object('role', i.role, 'email', i.email));
  end if;
end $$;

-- Exports (J3) and "view as" sessions (A6) are written to the audit log by organizers.
create or replace function public.log_organizer_event(p_venue uuid, p_action text, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_organizer(p_venue) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_action not in ('data.export', 'view_as.started', 'view_as.ended') then raise exception 'bad action' using errcode = '22023'; end if;
  perform private.log(p_venue, p_action, 'venue', p_venue, coalesce(p_details, '{}'));
  if p_action = 'view_as.started' and (p_details ->> 'target') is not null then
    insert into public.view_as_sessions (venue_id, actor_id, target_id) values (p_venue, private.current_person_id(), (p_details ->> 'target')::uuid);
  elsif p_action = 'view_as.ended' then
    update public.view_as_sessions set ended_at = now()
    where venue_id = p_venue and actor_id = private.current_person_id() and ended_at is null;
  end if;
end $$;

-- Audit rows with the actor's name (owners read the whole venue log; others only their own actions — RLS on audit_log).
create or replace function public.venue_audit(p_venue uuid, p_limit integer default 500)
returns table (id bigint, at timestamptz, action text, actor text, acted_as text, rule text, details jsonb)
language sql stable security definer set search_path = '' as $$
  select l.id, l.at, l.action, coalesce(p.display_name, 'System'), l.acted_as, l.rule, l.details
  from public.audit_log l left join public.persons p on p.id = l.actor_person_id
  where l.venue_id = p_venue and (private.is_venue_owner(p_venue) or l.actor_user_id = (select auth.uid()))
  order by l.at desc limit least(greatest(coalesce(p_limit, 500), 1), 2000)
$$;

revoke all on function public.revoke_invitation(uuid), public.log_organizer_event(uuid, text, jsonb), public.venue_audit(uuid, integer) from public, anon;
grant execute on function public.revoke_invitation(uuid), public.log_organizer_event(uuid, text, jsonb), public.venue_audit(uuid, integer) to authenticated;
