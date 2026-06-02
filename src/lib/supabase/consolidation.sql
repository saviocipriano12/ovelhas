-- Ovelhas - modulo de Consolidacao
-- Rode este arquivo no SQL Editor depois do reset/fix principal.
-- Pode rodar mais de uma vez.
-- Observacao: as permissoes comparam app_role como texto para permitir
-- adicionar o papel "consolidation" e configurar as policies no mesmo Run.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role'
      and e.enumlabel = 'consolidation'
  ) then
    alter type app_role add value 'consolidation';
  end if;
end;
$$;

create table if not exists public.consolidation_reports (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  service_date date not null,
  service_title text not null default 'Culto principal',
  total_attendance integer not null default 0,
  temple_count integer not null default 0,
  serving_count integer not null default 0,
  ministry_counts jsonb not null default '{}'::jsonb,
  kids_count integer not null default 0,
  baby_count integer not null default 0,
  vagalumes_count integer not null default 0,
  visitors_count integer not null default 0,
  accepted_jesus_count integer not null default 0,
  baptism_decision_count integer not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.consolidation_visitors (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.consolidation_reports(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  name text not null,
  phone text not null,
  email text,
  age integer,
  address text,
  neighborhood text,
  decision text not null default 'visitante'
    check (decision in ('visitante', 'aceitou_jesus', 'batismo', 'reconciliacao')),
  notes text,
  suggested_cell_id uuid references public.cells(id) on delete set null,
  suggested_cell_name text,
  created_at timestamptz not null default now()
);

alter table public.consolidation_reports
  add column if not exists ministry_counts jsonb not null default '{}'::jsonb,
  add column if not exists temple_count integer not null default 0,
  add column if not exists kids_count integer not null default 0,
  add column if not exists baby_count integer not null default 0,
  add column if not exists vagalumes_count integer not null default 0;

alter table public.consolidation_visitors
  add column if not exists age integer;

alter table public.consolidation_reports enable row level security;
alter table public.consolidation_visitors enable row level security;

create or replace function public.can_view_cell(target public.cells)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.church_id = target.church_id
      and (
        p.role::text in ('admin', 'pastor', 'consolidation')
        or (p.role::text = 'supervisor' and target.supervisor_id = p.id)
        or (p.role::text = 'leader' and target.leader_id = p.id)
        or (
          p.role::text = 'member'
          and exists (
            select 1
            from public.people pe
            where pe.person_user_id = p.id
              and pe.cell_id = target.id
              and pe.church_id = p.church_id
          )
        )
      )
  )
$$;

create or replace function public.can_view_person(target public.people)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and (
      (p.role::text in ('admin', 'pastor') and p.church_id = target.church_id)
      or (
        p.role::text = 'supervisor'
        and exists (
          select 1
          from public.cells c
          where c.id = target.cell_id
            and c.church_id = p.church_id
            and c.supervisor_id = p.id
        )
      )
      or (
        p.role::text = 'leader'
        and (
          target.leader_user_id = p.id
          or target.created_by_user_id = p.id
          or exists (
            select 1
            from public.cells c
            where c.id = target.cell_id
              and c.church_id = p.church_id
              and c.leader_id = p.id
          )
        )
      )
      or (p.role::text = 'consolidation' and p.church_id = target.church_id and target.created_by_user_id = p.id)
      or (p.role::text = 'member' and target.person_user_id = p.id)
    )
  )
$$;

create or replace function public.get_my_cells()
returns table (
  id uuid,
  church_id uuid,
  name text,
  leader_id uuid,
  supervisor_id uuid,
  meeting_day text,
  meeting_time text,
  address text,
  neighborhood text,
  active boolean
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  viewer public.profiles%rowtype;
begin
  select *
  into viewer
  from public.profiles
  where profiles.id = auth.uid()
  limit 1;

  if viewer.id is null or viewer.church_id is null then
    return;
  end if;

  return query
  select c.id, c.church_id, c.name, c.leader_id, c.supervisor_id, c.meeting_day, c.meeting_time, c.address, c.neighborhood, c.active
  from public.cells c
  where c.church_id = viewer.church_id
    and c.active is true
    and (
      viewer.role::text in ('admin', 'pastor', 'consolidation')
      or (viewer.role::text = 'supervisor' and c.supervisor_id = viewer.id)
      or (viewer.role::text = 'leader' and c.leader_id = viewer.id)
      or (
        viewer.role::text = 'member'
        and exists (
          select 1
          from public.people pe
          where pe.person_user_id = viewer.id
            and pe.cell_id = c.id
        )
      )
    )
  order by c.created_at desc;
end;
$$;

create or replace function public.get_my_people()
returns table (
  id uuid,
  church_id uuid,
  cell_id uuid,
  person_user_id uuid,
  created_by_user_id uuid,
  leader_user_id uuid,
  name text,
  phone text,
  email text,
  birth_date date,
  address text,
  neighborhood text,
  status text,
  journey_stage text,
  first_visit_date date,
  notes text
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  viewer public.profiles%rowtype;
begin
  select *
  into viewer
  from public.profiles
  where profiles.id = auth.uid()
  limit 1;

  if viewer.id is null or viewer.church_id is null then
    return;
  end if;

  return query
  select pe.id, pe.church_id, pe.cell_id, pe.person_user_id, pe.created_by_user_id, pe.leader_user_id,
         pe.name, pe.phone, pe.email, pe.birth_date, pe.address, pe.neighborhood, pe.status,
         pe.journey_stage, pe.first_visit_date, pe.notes
  from public.people pe
  left join public.cells c on c.id = pe.cell_id
  where pe.church_id = viewer.church_id
    and (
      viewer.role::text in ('admin', 'pastor')
      or (viewer.role::text = 'supervisor' and c.supervisor_id = viewer.id)
      or (
        viewer.role::text = 'leader'
        and (
          pe.leader_user_id = viewer.id
          or pe.created_by_user_id = viewer.id
          or c.leader_id = viewer.id
        )
      )
      or (viewer.role::text = 'consolidation' and pe.created_by_user_id = viewer.id)
      or (viewer.role::text = 'member' and pe.person_user_id = viewer.id)
    )
  order by pe.created_at desc;
end;
$$;

drop policy if exists "consolidation_reports_select_by_role" on public.consolidation_reports;
drop policy if exists "consolidation_reports_insert_by_role" on public.consolidation_reports;
drop policy if exists "consolidation_reports_delete_by_role" on public.consolidation_reports;
drop policy if exists "consolidation_visitors_select_by_role" on public.consolidation_visitors;
drop policy if exists "consolidation_visitors_insert_by_role" on public.consolidation_visitors;
drop policy if exists "consolidation_visitors_update_by_role" on public.consolidation_visitors;
drop policy if exists "consolidation_visitors_delete_by_role" on public.consolidation_visitors;

create policy "consolidation_reports_select_by_role"
on public.consolidation_reports
for select
to authenticated
using (
  church_id = public.current_app_church_id()
  and public.current_app_role()::text in ('admin', 'pastor', 'consolidation')
);

create policy "consolidation_reports_insert_by_role"
on public.consolidation_reports
for insert
to authenticated
with check (
  church_id = public.current_app_church_id()
  and public.current_app_role()::text in ('admin', 'pastor', 'consolidation')
);

create policy "consolidation_reports_delete_by_role"
on public.consolidation_reports
for delete
to authenticated
using (
  church_id = public.current_app_church_id()
  and (
    public.current_app_role()::text in ('admin', 'pastor')
    or created_by = auth.uid()
  )
);

create policy "consolidation_visitors_select_by_role"
on public.consolidation_visitors
for select
to authenticated
using (
  church_id = public.current_app_church_id()
  and public.current_app_role()::text in ('admin', 'pastor', 'consolidation')
);

create policy "consolidation_visitors_insert_by_role"
on public.consolidation_visitors
for insert
to authenticated
with check (
  church_id = public.current_app_church_id()
  and public.current_app_role()::text in ('admin', 'pastor', 'consolidation')
);

create policy "consolidation_visitors_update_by_role"
on public.consolidation_visitors
for update
to authenticated
using (
  church_id = public.current_app_church_id()
  and public.current_app_role()::text in ('admin', 'pastor', 'consolidation')
)
with check (
  church_id = public.current_app_church_id()
  and public.current_app_role()::text in ('admin', 'pastor', 'consolidation')
);

create policy "consolidation_visitors_delete_by_role"
on public.consolidation_visitors
for delete
to authenticated
using (
  church_id = public.current_app_church_id()
  and public.current_app_role()::text in ('admin', 'pastor', 'consolidation')
);

drop policy if exists "people_insert_by_leadership_safe" on public.people;
create policy "people_insert_by_leadership_safe"
on public.people
for insert
to authenticated
with check (
  church_id = public.current_app_church_id()
  and public.current_app_role()::text in ('admin', 'pastor', 'supervisor', 'leader', 'consolidation')
);

create or replace function public.can_create_invite(
  target_church_id uuid,
  target_role app_role,
  target_cell_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.church_id = target_church_id
      and (
        (
          p.role::text = 'admin'
          and (
            target_role::text in ('admin', 'pastor', 'supervisor', 'consolidation')
            or (
              target_role::text in ('leader', 'member')
              and exists (
                select 1 from public.cells c
                where c.id = target_cell_id
                  and c.church_id = target_church_id
              )
            )
          )
        )
        or (
          p.role::text = 'pastor'
          and (
            target_role::text in ('supervisor', 'consolidation')
            or (
              target_role::text in ('leader', 'member')
              and exists (
                select 1 from public.cells c
                where c.id = target_cell_id
                  and c.church_id = target_church_id
              )
            )
          )
        )
        or (
          p.role::text = 'supervisor'
          and target_role::text in ('leader', 'member')
          and exists (
            select 1 from public.cells c
            where c.id = target_cell_id
              and c.church_id = target_church_id
              and c.supervisor_id = p.id
          )
        )
        or (
          p.role::text = 'leader'
          and target_role::text = 'member'
          and exists (
            select 1 from public.cells c
            where c.id = target_cell_id
              and c.church_id = target_church_id
              and c.leader_id = p.id
          )
        )
      )
  )
$$;

grant select, insert, delete on public.consolidation_reports to authenticated;
grant select, insert, update, delete on public.consolidation_visitors to authenticated;
grant execute on function public.can_view_cell(public.cells) to authenticated;
grant execute on function public.can_view_person(public.people) to authenticated;
grant execute on function public.get_my_cells() to authenticated;
grant execute on function public.get_my_people() to authenticated;
grant execute on function public.can_create_invite(uuid, app_role, uuid) to authenticated;
