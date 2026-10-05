-- Appointments: a task of type "Appointment" also carries a time, a place and a kind.
-- Safe to run more than once.
alter table public.tasks
  add column if not exists due_time         text not null default '',
  add column if not exists location         text not null default '',
  add column if not exists appointment_kind text not null default '';

-- Tell the API layer about the new columns straight away.
notify pgrst, 'reload schema';
