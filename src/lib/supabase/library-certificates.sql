-- Ovelhas - biblioteca de materiais e certificados
-- Rode depois de schema.sql e discipleship.sql.

create table if not exists public.library_materials (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  track_id uuid references public.discipleship_tracks(id) on delete set null,
  title text not null,
  description text,
  material_type text not null default 'link',
  url text not null,
  audience text not null default 'member',
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  track_id uuid not null references public.discipleship_tracks(id) on delete cascade,
  title text not null,
  issued_by uuid references public.profiles(id) on delete set null,
  issued_by_name text,
  issued_at timestamptz not null default now(),
  unique (person_id, track_id)
);

alter table public.library_materials enable row level security;
alter table public.certificates enable row level security;

drop policy if exists "library_materials_select_by_audience" on public.library_materials;
create policy "library_materials_select_by_audience"
on public.library_materials
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = library_materials.church_id
    and (
      p.role in ('admin', 'pastor', 'supervisor')
      or (p.role = 'leader' and library_materials.audience in ('member', 'leader'))
      or (p.role = 'member' and library_materials.audience = 'member')
    )
  )
);

drop policy if exists "library_materials_insert_by_admin_or_pastor" on public.library_materials;
create policy "library_materials_insert_by_admin_or_pastor"
on public.library_materials
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = library_materials.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "certificates_select_by_responsibility" on public.certificates;
create policy "certificates_select_by_responsibility"
on public.certificates
for select
using (
  exists (
    select 1
    from public.people person
    where person.id = certificates.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "certificates_insert_by_leadership" on public.certificates;
create policy "certificates_insert_by_leadership"
on public.certificates
for insert
with check (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = certificates.person_id
    and person.church_id = certificates.church_id
    and (
      p.role in ('admin', 'pastor')
      or (
        p.role = 'leader'
        and (
          person.leader_user_id = p.id
          or exists (
            select 1
            from public.cells c
            where c.id = person.cell_id
            and c.leader_id = p.id
          )
        )
      )
    )
  )
);
