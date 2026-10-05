-- Matthews Consignment CRM: tables, access rules, realtime, starting territories.
-- Access model: a signed-in user sees and edits CRM data only if their account is
-- linked to an active row in team_members. The first person to sign in becomes the admin.

-- ---------------------------------------------------------------- team
create table public.team_members (
  id          text primary key,
  name        text not null default '',
  email       text,
  user_id     uuid unique references auth.users (id) on delete set null,
  active      boolean not null default true,
  is_admin    boolean not null default false,
  signature   text not null default '',
  created_at  timestamptz not null default now()
);
create unique index team_members_email_key on public.team_members (lower(email)) where email is not null and email <> '';

-- ---------------------------------------------------------------- territories
create table public.territories (
  code      text primary key,
  name      text not null default '',
  state     text not null default '',
  owner_id  text references public.team_members (id) on delete set null,
  active    boolean not null default true,
  notes     text not null default '',
  cities    text[] not null default '{}',
  counties  text[] not null default '{}',
  zips      text[] not null default '{}'
);

-- ---------------------------------------------------------------- companies
create table public.companies (
  id                        text primary key,
  name                      text not null default '',
  territory_code            text not null default 'UNASSIGNED',
  territory_match           text not null default '',
  address                   text not null default '',
  city                      text not null default '',
  county                    text not null default '',
  state                     text not null default '',
  zip                       text not null default '',
  website                   text not null default '',
  main_phone                text not null default '',
  industry                  text not null default '',
  sub_industry              text not null default '',
  lead_source               text not null default '',
  lead_type                 text not null default '',
  prospect_priority         text not null default '',
  lead_status               text not null default 'New',
  lead_status_at            timestamptz,
  asset_potential           text[] not null default '{}',
  assigned_rep_id           text references public.team_members (id) on delete set null,
  last_contact_base         date,
  next_follow_up            date,
  last_contact_method_base  text not null default '',
  outreach_attempts_base    integer not null default 0,
  email_opt_out             boolean not null default false,
  do_not_call               boolean not null default false,
  notes                     text not null default '',
  source_url                text not null default '',
  duplicate_ok_signature    text not null default '',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index companies_territory_idx on public.companies (territory_code);
create index companies_follow_up_idx on public.companies (next_follow_up);

-- ---------------------------------------------------------------- contacts
create table public.contacts (
  id              text primary key,
  company_id      text references public.companies (id) on delete cascade,
  first_name      text not null default '',
  last_name       text not null default '',
  job_title       text not null default '',
  department      text not null default '',
  email           text not null default '',
  phone           text not null default '',
  mobile_phone    text not null default '',
  contact_role    text not null default '',
  is_primary      boolean not null default false,
  email_opt_out   boolean not null default false,
  do_not_call     boolean not null default false,
  notes           text not null default '',
  next_follow_up  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index contacts_company_idx on public.contacts (company_id);
create index contacts_email_idx on public.contacts (lower(email));

-- ---------------------------------------------------------------- activities
create table public.activities (
  id              text primary key,
  company_id      text references public.companies (id) on delete cascade,
  contact_id      text references public.contacts (id) on delete set null,
  activity_type   text not null default 'Note',
  occurred_at     timestamptz not null default now(),
  logged_by_id    text references public.team_members (id) on delete set null,
  outcome         text not null default '',
  notes           text not null default '',
  next_follow_up  date,
  created_at      timestamptz not null default now()
);
create index activities_company_idx on public.activities (company_id);
create index activities_occurred_idx on public.activities (occurred_at);

-- ---------------------------------------------------------------- tasks
create table public.tasks (
  id              text primary key,
  name            text not null default '',
  company_id      text references public.companies (id) on delete cascade,
  contact_id      text references public.contacts (id) on delete set null,
  assigned_to_id  text references public.team_members (id) on delete set null,
  due_date        date,
  task_type       text not null default 'Follow-Up',
  priority        text not null default 'Normal',
  status          text not null default 'Open',
  notes           text not null default '',
  auto_source     text not null default '',
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index tasks_company_idx on public.tasks (company_id);
create index tasks_due_idx on public.tasks (due_date);

-- ---------------------------------------------------------------- opportunities
create table public.opportunities (
  id                     text primary key,
  name                   text not null default '',
  company_id             text references public.companies (id) on delete cascade,
  contact_id             text references public.contacts (id) on delete set null,
  assigned_rep_id        text references public.team_members (id) on delete set null,
  equipment_category     text not null default '',
  equipment_description  text not null default '',
  estimated_units        integer,
  estimated_value        numeric,
  auction_date           date,
  commission_structure   text not null default '',
  equipment_location     text not null default '',
  stage                  text not null default 'Identified',
  probability            integer,
  expected_close_date    date,
  notes                  text not null default '',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index opportunities_company_idx on public.opportunities (company_id);

-- ---------------------------------------------------------------- email drafts
create table public.email_drafts (
  id             text primary key,
  company_id     text references public.companies (id) on delete cascade,
  contact_id     text references public.contacts (id) on delete set null,
  to_email       text not null default '',
  purpose        text not null default 'intro',
  subject        text not null default '',
  body           text not null default '',
  instructions   text not null default '',
  drafted_by_id  text references public.team_members (id) on delete set null,
  gmail_at       timestamptz,
  gmail_url      text not null default '',
  created_at     timestamptz not null default now()
);
create index email_drafts_company_idx on public.email_drafts (company_id);

-- ---------------------------------------------------------------- settings
create table public.settings (
  key    text primary key,
  value  jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------- who is allowed
create or replace function public.is_member() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.team_members t where t.user_id = auth.uid() and t.active) $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.team_members t where t.user_id = auth.uid() and t.active and t.is_admin) $$;

-- Called once after sign-in. Links the account to the team member with the same email.
-- If the CRM has no admin yet, the caller becomes the first admin.
create or replace function public.link_me() returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_row   public.team_members;
begin
  if v_uid is null then return null; end if;
  select * into v_row from public.team_members where user_id = v_uid;
  if found then return to_jsonb(v_row); end if;
  if v_email <> '' then
    update public.team_members set user_id = v_uid
      where lower(email) = v_email and user_id is null
      returning * into v_row;
    if found then return to_jsonb(v_row); end if;
  end if;
  if not exists (select 1 from public.team_members where is_admin and user_id is not null) then
    insert into public.team_members (id, name, email, user_id, active, is_admin)
      values ('r' || replace(gen_random_uuid()::text, '-', ''), initcap(split_part(v_email, '@', 1)), nullif(v_email, ''), v_uid, true, true)
      returning * into v_row;
    return to_jsonb(v_row);
  end if;
  return null;
end $$;

-- Lets any member change their own display name and email signature.
create or replace function public.set_my_profile(p_name text, p_signature text) returns void
  language sql security definer set search_path = public
  as $$
    update public.team_members
       set name = coalesce(nullif(btrim(p_name), ''), name),
           signature = coalesce(p_signature, signature)
     where user_id = auth.uid();
  $$;

revoke execute on function public.is_member() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.link_me() from public, anon;
revoke execute on function public.set_my_profile(text, text) from public, anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.link_me() to authenticated;
grant execute on function public.set_my_profile(text, text) to authenticated;

-- ---------------------------------------------------------------- row level security
alter table public.team_members  enable row level security;
alter table public.territories   enable row level security;
alter table public.companies     enable row level security;
alter table public.contacts      enable row level security;
alter table public.activities    enable row level security;
alter table public.tasks         enable row level security;
alter table public.opportunities enable row level security;
alter table public.email_drafts  enable row level security;
alter table public.settings      enable row level security;

grant select, insert, update, delete on
  public.team_members, public.territories, public.companies, public.contacts, public.activities,
  public.tasks, public.opportunities, public.email_drafts, public.settings
  to authenticated;

create policy crm_members on public.territories   for all to authenticated using (public.is_member()) with check (public.is_member());
create policy crm_members on public.companies     for all to authenticated using (public.is_member()) with check (public.is_member());
create policy crm_members on public.contacts      for all to authenticated using (public.is_member()) with check (public.is_member());
create policy crm_members on public.activities    for all to authenticated using (public.is_member()) with check (public.is_member());
create policy crm_members on public.tasks         for all to authenticated using (public.is_member()) with check (public.is_member());
create policy crm_members on public.opportunities for all to authenticated using (public.is_member()) with check (public.is_member());
create policy crm_members on public.email_drafts  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy crm_members on public.settings      for all to authenticated using (public.is_member()) with check (public.is_member());

-- Team: every member can read it. Admins manage it. Any member may add a name-only
-- entry (a spreadsheet import does this for reps it has not seen), which grants no access.
create policy team_read   on public.team_members for select to authenticated using (public.is_member());
create policy team_insert on public.team_members for insert to authenticated
  with check (public.is_admin() or (public.is_member() and is_admin = false and user_id is null and coalesce(email, '') = ''));
create policy team_update on public.team_members for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy team_delete on public.team_members for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- live updates between users
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.team_members, public.territories, public.companies, public.contacts, public.activities,
      public.tasks, public.opportunities, public.email_drafts, public.settings;
  end if;
end $$;

-- ---------------------------------------------------------------- starting territories
insert into public.territories (code, name, state, cities, counties, zips) values
  ('NRV', 'New River Valley', 'VA',
    array['Christiansburg, VA','Blacksburg, VA','Radford, VA','Pulaski, VA','Dublin, VA'],
    array['Montgomery, VA','Pulaski, VA'],
    array['24073','24060','24141','24301','24084']),
  ('SWVA-W', 'Southwest Virginia West', 'VA',
    array['Galax, VA','Hillsville, VA','Wytheville, VA','Marion, VA'],
    array['Grayson, VA','Carroll, VA','Wythe, VA','Smyth, VA'],
    array['24333','24343','24382','24354']),
  ('ROA', 'Roanoke Valley', 'VA',
    array['Roanoke, VA','Salem, VA','Vinton, VA'],
    array['Botetourt, VA','Franklin, VA'],
    array['24011','24012','24013','24014','24015','24016','24017','24018','24019','24153','24179']),
  ('SOVA', 'Southern Virginia', 'VA',
    array['Martinsville, VA','Danville, VA'],
    array['Henry, VA','Pittsylvania, VA'],
    array['24112','24540','24541']),
  ('NWNC', 'Northwest North Carolina', 'NC',
    array['Mount Airy, NC','Elkin, NC','Sparta, NC','Jefferson, NC','North Wilkesboro, NC','Wilkesboro, NC','Boone, NC'],
    array[]::text[],
    array['27030','28621','28675','28640','28659','28697','28607']),
  ('TRIAD', 'Piedmont Triad', 'NC',
    array['Winston-Salem, NC','Greensboro, NC','High Point, NC','Kernersville, NC','Burlington, NC'],
    array[]::text[],
    array['27101','27103','27104','27105','27106','27107','27127','27401','27403','27405','27406','27407','27408','27409','27410','27455','27260','27262','27263','27265','27284','27215','27217']),
  ('STV-I77', 'Statesville / I-77 Corridor', 'NC',
    array['Statesville, NC','Mooresville, NC','Troutman, NC','Hickory, NC','Conover, NC','Newton, NC'],
    array[]::text[],
    array['28625','28677','28115','28117','28166','28601','28602','28613','28658'])
on conflict (code) do nothing;
