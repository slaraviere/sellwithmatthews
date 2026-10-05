-- Lines of business (Equipment, Estate, Real Estate) and multi-item opportunities.
-- Safe to run more than once.
alter table public.companies
  add column if not exists lines text[] not null default '{}';

alter table public.opportunities
  add column if not exists line            text  not null default 'Equipment',
  add column if not exists items           jsonb not null default '[]'::jsonb,
  add column if not exists details         jsonb not null default '{}'::jsonb,
  add column if not exists referred_by_id  text  references public.companies (id) on delete set null;

create index if not exists opportunities_line_idx on public.opportunities (line);

-- Counts of what is in the open pipeline, by item type (the same numbers the CRM shows).
-- Example:  select * from public.pipeline_items order by units desc;
create or replace view public.pipeline_items with (security_invoker = true) as
  select o.line,
         i ->> 'type'                                             as item_type,
         sum(coalesce(nullif(i ->> 'qty', '')::numeric, 1))       as units,
         sum(coalesce(nullif(i ->> 'value', '')::numeric, 0))     as estimated_value,
         count(distinct o.id)                                     as opportunities
    from public.opportunities o
    cross join lateral jsonb_array_elements(o.items) as i
   where o.stage not in ('Sold', 'No Sale', 'Lost', 'Future Opportunity', 'Settled', 'Closed')
   group by o.line, i ->> 'type';

grant select on public.pipeline_items to authenticated;

notify pgrst, 'reload schema';
