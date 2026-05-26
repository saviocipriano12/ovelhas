-- Ovelhas - supervisao e prestacao de contas
-- Rode no SQL Editor depois do schema/bootstrap.

create table if not exists public.supervisor_visits (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  cell_id uuid not null references public.cells(id) on delete cascade,
  supervisor_id uuid references public.profiles(id),
  leader_id uuid references public.profiles(id),
  visit_date date not null,
  visit_type text not null default 'Presencial',
  leader_present boolean not null default true,
  health_score integer not null default 80,
  notes text,
  next_steps text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  actor_name text not null,
  actor_role app_role not null,
  action text not null,
  description text not null,
  target_type text not null,
  target_id text,
  target_name text,
  cell_id uuid references public.cells(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  visibility text not null default 'leadership',
  created_at timestamptz not null default now()
);

alter table public.supervisor_visits enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "supervisor_visits_select_by_role" on public.supervisor_visits;
create policy "supervisor_visits_select_by_role"
on public.supervisor_visits
for select
using (
  exists (
    select 1
    from public.profiles p
    left join public.cells c on c.id = supervisor_visits.cell_id
    where p.id = auth.uid()
    and (
      (p.role in ('admin', 'pastor') and p.church_id = supervisor_visits.church_id)
      or (p.role = 'supervisor' and (p.id = supervisor_visits.supervisor_id or p.id = c.supervisor_id))
      or (p.role = 'leader' and p.id = c.leader_id)
    )
  )
);

drop policy if exists "supervisor_visits_insert_by_supervisor_or_admin" on public.supervisor_visits;
create policy "supervisor_visits_insert_by_supervisor_or_admin"
on public.supervisor_visits
for insert
with check (
  exists (
    select 1
    from public.profiles p
    left join public.cells c on c.id = supervisor_visits.cell_id
    where p.id = auth.uid()
    and (
      (p.role in ('admin', 'pastor') and p.church_id = supervisor_visits.church_id)
      or (p.role = 'supervisor' and p.id = c.supervisor_id)
    )
  )
);

drop policy if exists "activity_events_select_by_role" on public.activity_events;
create policy "activity_events_select_by_role"
on public.activity_events
for select
using (
  exists (
    select 1
    from public.profiles p
    left join public.cells c on c.id = activity_events.cell_id
    left join public.people pe on pe.id = activity_events.person_id
    where p.id = auth.uid()
    and (
      (p.role in ('admin', 'pastor') and p.church_id = activity_events.church_id and activity_events.visibility <> 'member')
      or (p.role = 'supervisor' and (p.id = c.supervisor_id or p.id = activity_events.actor_user_id))
      or (p.role = 'leader' and (p.id = c.leader_id or p.id = pe.leader_user_id or p.id = activity_events.actor_user_id))
      or (p.role = 'member' and activity_events.visibility = 'member' and p.id = activity_events.actor_user_id)
    )
  )
);

drop policy if exists "activity_events_insert_authenticated" on public.activity_events;
create policy "activity_events_insert_authenticated"
on public.activity_events
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = activity_events.church_id
  )
);
