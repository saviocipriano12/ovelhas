-- Ovelhas - agenda pastoral e lembretes
-- Rode depois de schema.sql e person-profile.sql.

create table if not exists public.pastoral_reminders (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  reminder_type text not null default 'outro',
  due_at timestamptz not null,
  status text not null default 'open',
  person_id uuid references public.people(id) on delete set null,
  cell_id uuid references public.cells(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.pastoral_reminders enable row level security;

drop policy if exists "pastoral_reminders_select_by_responsibility" on public.pastoral_reminders;
create policy "pastoral_reminders_select_by_responsibility"
on public.pastoral_reminders
for select
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = pastoral_reminders.church_id
    and p.role in ('admin', 'pastor')
  )
  or exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = pastoral_reminders.cell_id
    and (
      (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
    )
  )
  or exists (
    select 1
    from public.people person
    where person.id = pastoral_reminders.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "pastoral_reminders_insert_by_leadership" on public.pastoral_reminders;
create policy "pastoral_reminders_insert_by_leadership"
on public.pastoral_reminders
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = pastoral_reminders.church_id
    and p.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "pastoral_reminders_update_by_responsibility" on public.pastoral_reminders;
create policy "pastoral_reminders_update_by_responsibility"
on public.pastoral_reminders
for update
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = pastoral_reminders.church_id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = pastoral_reminders.church_id
    and p.role in ('admin', 'pastor')
  )
);
