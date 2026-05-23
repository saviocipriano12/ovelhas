-- Ovelhas - check-in por QR/codigo
-- Rode depois de schema.sql e attendance.sql.

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  cell_id uuid not null references public.cells(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  person_name text not null,
  checkin_type text not null default 'cell',
  checkin_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (cell_id, person_id, checkin_type, checkin_date)
);

alter table public.checkins enable row level security;

drop policy if exists "checkins_select_by_cell_access" on public.checkins;
create policy "checkins_select_by_cell_access"
on public.checkins
for select
using (
  exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = checkins.cell_id
    and (
      (p.role in ('admin', 'pastor') and p.church_id = c.church_id)
      or (p.role = 'supervisor' and p.id = c.supervisor_id)
      or (p.role = 'leader' and p.id = c.leader_id)
      or exists (
        select 1
        from public.people person
        where person.id = checkins.person_id
        and person.person_user_id = p.id
      )
    )
  )
);

drop policy if exists "checkins_insert_authenticated" on public.checkins;
create policy "checkins_insert_authenticated"
on public.checkins
for insert
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.cells c
    where c.id = checkins.cell_id
    and c.church_id = checkins.church_id
  )
);
