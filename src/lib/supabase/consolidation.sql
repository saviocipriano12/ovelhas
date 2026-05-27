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
  serving_count integer not null default 0,
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
  address text,
  neighborhood text,
  decision text not null default 'visitante'
    check (decision in ('visitante', 'aceitou_jesus', 'batismo', 'reconciliacao')),
  notes text,
  suggested_cell_id uuid references public.cells(id) on delete set null,
  suggested_cell_name text,
  created_at timestamptz not null default now()
);

alter table public.consolidation_reports enable row level security;
alter table public.consolidation_visitors enable row level security;

drop policy if exists "consolidation_reports_select_by_role" on public.consolidation_reports;
drop policy if exists "consolidation_reports_insert_by_role" on public.consolidation_reports;
drop policy if exists "consolidation_reports_delete_by_role" on public.consolidation_reports;
drop policy if exists "consolidation_visitors_select_by_role" on public.consolidation_visitors;
drop policy if exists "consolidation_visitors_insert_by_role" on public.consolidation_visitors;
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
grant select, insert, delete on public.consolidation_visitors to authenticated;
grant execute on function public.can_create_invite(uuid, app_role, uuid) to authenticated;
