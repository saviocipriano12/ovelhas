-- Ovelhas - confirmacao semanal de presenca pelo membro
-- Rode depois de schema.sql.

create table if not exists public.cell_rsvps (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  cell_id uuid not null references public.cells(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  person_name text not null,
  meeting_date date not null,
  response text not null check (response in ('yes', 'no', 'maybe')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, cell_id, meeting_date)
);

alter table public.cell_rsvps enable row level security;

drop policy if exists "cell_rsvps_select_by_responsibility" on public.cell_rsvps;
create policy "cell_rsvps_select_by_responsibility"
on public.cell_rsvps
for select
using (
  exists (
    select 1
    from public.profiles p
    left join public.cells c on c.id = cell_rsvps.cell_id
    left join public.people person on person.id = cell_rsvps.person_id
    where p.id = auth.uid()
    and p.church_id = cell_rsvps.church_id
    and (
      p.role in ('admin', 'pastor')
      or (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
      or person.person_user_id = p.id
    )
  )
);

drop policy if exists "cell_rsvps_upsert_by_member_or_leader" on public.cell_rsvps;
create policy "cell_rsvps_upsert_by_member_or_leader"
on public.cell_rsvps
for insert
with check (
  exists (
    select 1
    from public.profiles p
    left join public.cells c on c.id = cell_rsvps.cell_id
    left join public.people person on person.id = cell_rsvps.person_id
    where p.id = auth.uid()
    and p.church_id = cell_rsvps.church_id
    and (
      p.role in ('admin', 'pastor')
      or (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
      or person.person_user_id = p.id
    )
  )
);

drop policy if exists "cell_rsvps_update_by_member_or_leader" on public.cell_rsvps;
create policy "cell_rsvps_update_by_member_or_leader"
on public.cell_rsvps
for update
using (
  exists (
    select 1
    from public.profiles p
    left join public.cells c on c.id = cell_rsvps.cell_id
    left join public.people person on person.id = cell_rsvps.person_id
    where p.id = auth.uid()
    and p.church_id = cell_rsvps.church_id
    and (
      p.role in ('admin', 'pastor')
      or (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
      or person.person_user_id = p.id
    )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    left join public.cells c on c.id = cell_rsvps.cell_id
    left join public.people person on person.id = cell_rsvps.person_id
    where p.id = auth.uid()
    and p.church_id = cell_rsvps.church_id
    and (
      p.role in ('admin', 'pastor')
      or (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
      or person.person_user_id = p.id
    )
  )
);
