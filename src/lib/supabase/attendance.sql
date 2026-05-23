-- Ovelhas - presenca real, culto e cuidados automaticos
-- Rode depois de schema.sql e admin-management.sql.

create table if not exists public.church_services (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  service_date date not null,
  title text not null default 'Culto principal',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.service_attendance (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.church_services(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  present boolean not null default false,
  created_at timestamptz not null default now(),
  unique (service_id, person_id)
);

alter table public.church_services enable row level security;
alter table public.service_attendance enable row level security;

drop policy if exists "cell_meetings_select_by_cell_access" on public.cell_meetings;
create policy "cell_meetings_select_by_cell_access"
on public.cell_meetings
for select
using (
  exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = cell_meetings.cell_id
    and (
      (p.role in ('admin', 'pastor') and p.church_id = c.church_id)
      or (p.role = 'supervisor' and p.id = c.supervisor_id)
      or (p.role = 'leader' and p.id = c.leader_id)
    )
  )
);

drop policy if exists "cell_meetings_insert_by_cell_leadership" on public.cell_meetings;
create policy "cell_meetings_insert_by_cell_leadership"
on public.cell_meetings
for insert
with check (
  exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = cell_meetings.cell_id
    and (
      (p.role in ('admin', 'pastor') and p.church_id = c.church_id)
      or (p.role = 'supervisor' and p.id = c.supervisor_id)
      or (p.role = 'leader' and p.id = c.leader_id)
    )
  )
);

drop policy if exists "cell_attendance_select_by_meeting_access" on public.cell_attendance;
create policy "cell_attendance_select_by_meeting_access"
on public.cell_attendance
for select
using (
  exists (
    select 1
    from public.cell_meetings m
    join public.cells c on c.id = m.cell_id
    join public.profiles p on p.id = auth.uid()
    where m.id = cell_attendance.meeting_id
    and (
      (p.role in ('admin', 'pastor') and p.church_id = c.church_id)
      or (p.role = 'supervisor' and p.id = c.supervisor_id)
      or (p.role = 'leader' and p.id = c.leader_id)
    )
  )
);

drop policy if exists "cell_attendance_insert_by_meeting_access" on public.cell_attendance;
create policy "cell_attendance_insert_by_meeting_access"
on public.cell_attendance
for insert
with check (
  exists (
    select 1
    from public.cell_meetings m
    join public.cells c on c.id = m.cell_id
    join public.profiles p on p.id = auth.uid()
    where m.id = cell_attendance.meeting_id
    and (
      (p.role in ('admin', 'pastor') and p.church_id = c.church_id)
      or (p.role = 'supervisor' and p.id = c.supervisor_id)
      or (p.role = 'leader' and p.id = c.leader_id)
    )
  )
);

drop policy if exists "church_services_select_by_church_leadership" on public.church_services;
create policy "church_services_select_by_church_leadership"
on public.church_services
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_services.church_id
    and p.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "church_services_insert_by_church_leadership" on public.church_services;
create policy "church_services_insert_by_church_leadership"
on public.church_services
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_services.church_id
    and p.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "service_attendance_select_by_person_access" on public.service_attendance;
create policy "service_attendance_select_by_person_access"
on public.service_attendance
for select
using (
  exists (
    select 1
    from public.people person
    where person.id = service_attendance.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "service_attendance_insert_by_church_leadership" on public.service_attendance;
create policy "service_attendance_insert_by_church_leadership"
on public.service_attendance
for insert
with check (
  exists (
    select 1
    from public.church_services service
    join public.people person on person.id = service_attendance.person_id
    join public.profiles p on p.id = auth.uid()
    where service.id = service_attendance.service_id
    and person.church_id = service.church_id
    and p.church_id = service.church_id
    and p.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "follow_ups_select_by_responsibility" on public.follow_ups;
create policy "follow_ups_select_by_responsibility"
on public.follow_ups
for select
using (
  exists (
    select 1
    from public.people person
    where person.id = follow_ups.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "follow_ups_insert_by_leadership" on public.follow_ups;
create policy "follow_ups_insert_by_leadership"
on public.follow_ups
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = follow_ups.church_id
    and p.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "follow_ups_update_by_assignee_or_leadership" on public.follow_ups;
create policy "follow_ups_update_by_assignee_or_leadership"
on public.follow_ups
for update
using (
  assigned_to = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = follow_ups.church_id
    and p.role in ('admin', 'pastor', 'supervisor')
  )
)
with check (
  assigned_to = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = follow_ups.church_id
    and p.role in ('admin', 'pastor', 'supervisor')
  )
);
