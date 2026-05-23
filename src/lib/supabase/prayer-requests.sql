-- Ovelhas - pedidos de oracao com privacidade
-- Rode depois de schema.sql e person-profile.sql.

create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  cell_id uuid references public.cells(id) on delete set null,
  title text not null,
  request text not null,
  visibility text not null default 'leader_only',
  status text not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  answered_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.prayer_requests enable row level security;

drop policy if exists "prayer_requests_select_by_visibility" on public.prayer_requests;
create policy "prayer_requests_select_by_visibility"
on public.prayer_requests
for select
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.people person
    join public.profiles viewer on viewer.id = auth.uid()
    left join public.cells c on c.id = prayer_requests.cell_id
    where person.id = prayer_requests.person_id
    and public.can_view_person(person)
    and (
      person.person_user_id = viewer.id
      or (
        prayer_requests.visibility = 'leader_only'
        and viewer.role = 'leader'
        and (
          person.leader_user_id = viewer.id
          or c.leader_id = viewer.id
        )
      )
      or (
        prayer_requests.visibility = 'leadership'
        and viewer.role in ('admin', 'pastor', 'supervisor', 'leader')
      )
      or (
        prayer_requests.visibility = 'pastor_only'
        and viewer.role in ('admin', 'pastor')
      )
      or (
        prayer_requests.visibility = 'cell_public'
        and (
          viewer.role in ('admin', 'pastor', 'supervisor', 'leader')
          or person.person_user_id = viewer.id
        )
      )
    )
  )
);

drop policy if exists "prayer_requests_insert_by_visible_person" on public.prayer_requests;
create policy "prayer_requests_insert_by_visible_person"
on public.prayer_requests
for insert
with check (
  exists (
    select 1
    from public.people person
    join public.profiles viewer on viewer.id = auth.uid()
    where person.id = prayer_requests.person_id
    and person.church_id = prayer_requests.church_id
    and (
      person.person_user_id = viewer.id
      or viewer.role in ('admin', 'pastor', 'supervisor', 'leader')
    )
    and public.can_view_person(person)
  )
);

drop policy if exists "prayer_requests_update_by_leadership" on public.prayer_requests;
create policy "prayer_requests_update_by_leadership"
on public.prayer_requests
for update
using (
  exists (
    select 1
    from public.people person
    join public.profiles viewer on viewer.id = auth.uid()
    where person.id = prayer_requests.person_id
    and (
      viewer.role in ('admin', 'pastor')
      or (
        viewer.role = 'supervisor'
        and exists (
          select 1
          from public.cells c
          where c.id = prayer_requests.cell_id
          and c.supervisor_id = viewer.id
        )
      )
      or (
        viewer.role = 'leader'
        and (
          person.leader_user_id = viewer.id
          or exists (
            select 1
            from public.cells c
            where c.id = prayer_requests.cell_id
            and c.leader_id = viewer.id
          )
        )
      )
    )
  )
)
with check (
  exists (
    select 1
    from public.people person
    join public.profiles viewer on viewer.id = auth.uid()
    where person.id = prayer_requests.person_id
    and (
      viewer.role in ('admin', 'pastor')
      or (
        viewer.role = 'supervisor'
        and exists (
          select 1
          from public.cells c
          where c.id = prayer_requests.cell_id
          and c.supervisor_id = viewer.id
        )
      )
      or (
        viewer.role = 'leader'
        and (
          person.leader_user_id = viewer.id
          or exists (
            select 1
            from public.cells c
            where c.id = prayer_requests.cell_id
            and c.leader_id = viewer.id
          )
        )
      )
    )
  )
);
