-- Calendar link: lets a team member subscribe to CRM appointments from Google Calendar
-- (or any calendar app). Each member gets a private link that is long and random. The
-- link can read appointments and nothing else. Making a new link stops the old one.

create table if not exists public.calendar_links (
  member_id  text primary key references public.team_members (id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);
-- No policies on purpose: nobody reads or writes this table directly, only the two functions below.
alter table public.calendar_links enable row level security;
revoke all on public.calendar_links from anon, authenticated;

-- The signed-in team member's own link token. Creates one the first time, or a new one when asked to reset.
create or replace function public.my_calendar_token(p_reset boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare
  me  text;
  tok text;
begin
  select id into me from public.team_members where user_id = auth.uid() and active limit 1;
  if me is null then
    raise exception 'Only CRM team members have a calendar link' using errcode = '42501';
  end if;
  select token into tok from public.calendar_links where member_id = me;
  if tok is null or p_reset then
    tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into public.calendar_links (member_id, token) values (me, tok)
      on conflict (member_id) do update set token = excluded.token, created_at = now();
  end if;
  return tok;
end $$;

-- What a calendar app gets when it opens a link: that member's appointments ('mine') or the whole
-- team's ('all'), from 60 days back onward. Returns null when the link is not valid.
create or replace function public.calendar_feed(p_token text, p_who text default 'mine') returns jsonb
language sql stable security definer set search_path = public as $$
  select case when m.id is null then null else coalesce((
    select jsonb_agg(e order by e ->> 'due_date', e ->> 'due_time') from (
      select jsonb_build_object(
               'id', t.id, 'name', t.name, 'due_date', t.due_date, 'due_time', t.due_time, 'kind', t.appointment_kind,
               'location', t.location, 'notes', t.notes, 'status', t.status,
               'company', coalesce(c.name, ''), 'company_phone', coalesce(c.main_phone, ''),
               'contact', btrim(coalesce(k.first_name, '') || ' ' || coalesce(k.last_name, '')),
               'contact_phone', coalesce(nullif(k.mobile_phone, ''), k.phone, ''),
               'rep', coalesce(r.name, '')) as e
        from public.tasks t
        left join public.companies c on c.id = t.company_id
        left join public.contacts k on k.id = t.contact_id
        left join public.team_members r on r.id = t.assigned_to_id
       where t.task_type = 'Appointment' and t.status <> 'Cancelled' and t.due_date is not null
         and t.due_date >= current_date - 60
         and (p_who = 'all' or t.assigned_to_id = m.id)
       order by t.due_date, t.due_time
       limit 500) x), '[]'::jsonb) end
    from (select 1) one
    left join public.calendar_links l on l.token = p_token and char_length(p_token) >= 32
    left join public.team_members m on m.id = l.member_id and m.active;
$$;

revoke all on function public.my_calendar_token(boolean) from public, anon;
grant execute on function public.my_calendar_token(boolean) to authenticated;
revoke all on function public.calendar_feed(text, text) from public;
grant execute on function public.calendar_feed(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
