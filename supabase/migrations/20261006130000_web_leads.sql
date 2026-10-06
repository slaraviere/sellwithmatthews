-- Web leads: what people send from the public "Sell with Matthews" pages.
-- Anyone can add a row (that is the form). Only signed-in team members can read,
-- handle or delete them. A visitor can never read anything back, and can only fill
-- in the columns the form has.

create table if not exists public.web_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  phone         text not null default '' check (char_length(phone) <= 40),
  email         text not null default '' check (char_length(email) <= 200),
  company       text not null default '' check (char_length(company) <= 160),
  zip           text not null default '' check (char_length(zip) <= 20),
  program       text not null default '' check (char_length(program) <= 40),
  details       text not null default '' check (char_length(details) <= 2000),
  source        text not null default '' check (char_length(source) <= 200),
  page          text not null default '' check (char_length(page) <= 200),
  status        text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  company_id    text references public.companies (id) on delete set null,
  handled_by_id text references public.team_members (id) on delete set null,
  handled_at    timestamptz,
  constraint web_leads_reachable check (phone <> '' or email <> '')
);
create index if not exists web_leads_status_idx on public.web_leads (status, created_at desc);

alter table public.web_leads enable row level security;

revoke all on public.web_leads from anon, authenticated;
grant insert (name, phone, email, company, zip, program, details, source, page) on public.web_leads to anon, authenticated;
grant select, update, delete on public.web_leads to authenticated;

drop policy if exists web_leads_send   on public.web_leads;
drop policy if exists web_leads_read   on public.web_leads;
drop policy if exists web_leads_handle on public.web_leads;
drop policy if exists web_leads_remove on public.web_leads;
create policy web_leads_send   on public.web_leads for insert to anon, authenticated with check (true);
create policy web_leads_read   on public.web_leads for select to authenticated using (public.is_member());
create policy web_leads_handle on public.web_leads for update to authenticated using (public.is_member()) with check (public.is_member());
create policy web_leads_remove on public.web_leads for delete to authenticated using (public.is_member());

-- live alert in the CRM when a lead arrives
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'web_leads') then
    alter publication supabase_realtime add table public.web_leads;
  end if;
end $$;

notify pgrst, 'reload schema';
