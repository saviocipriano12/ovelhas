-- Ovelhas - Lar de Paz (casas e duplas)
-- Rode depois de schema.sql e admin-management.sql.

-- Duplas primeiro: house_id fica sem FK aqui porque peace_houses ainda nao existe.
-- A FK de peace_pairs.house_id para peace_houses(id) e adicionada no final deste arquivo.
create table if not exists public.peace_pairs (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  cell_id uuid not null references public.cells(id) on delete cascade,
  name text not null,
  phone text,
  has_house boolean not null default false,
  house_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.peace_houses (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  cell_id uuid references public.cells(id) on delete set null,
  full_name text not null,
  age integer,
  sex text check (sex in ('feminino', 'masculino')),
  phone text,
  address text not null,
  house_number text,
  neighborhood text,
  city text,
  has_pair boolean not null default false,
  pair_id uuid references public.peace_pairs(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.peace_pairs drop constraint if exists peace_pairs_house_id_fkey;
alter table public.peace_pairs
  add constraint peace_pairs_house_id_fkey foreign key (house_id) references public.peace_houses(id) on delete set null;

alter table public.peace_pairs enable row level security;
alter table public.peace_houses enable row level security;

-- Duplas ---------------------------------------------------------------

drop policy if exists "peace_pairs_select_by_responsibility" on public.peace_pairs;
create policy "peace_pairs_select_by_responsibility"
on public.peace_pairs
for select
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = peace_pairs.church_id
    and p.role in ('admin', 'pastor')
  )
  or exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = peace_pairs.cell_id
    and (
      (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
    )
  )
);

drop policy if exists "peace_pairs_insert_by_leadership" on public.peace_pairs;
create policy "peace_pairs_insert_by_leadership"
on public.peace_pairs
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = peace_pairs.church_id
    and p.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "peace_pairs_update_by_responsibility" on public.peace_pairs;
create policy "peace_pairs_update_by_responsibility"
on public.peace_pairs
for update
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = peace_pairs.church_id
    and p.role in ('admin', 'pastor')
  )
  or exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = peace_pairs.cell_id
    and (
      (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
    )
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = peace_pairs.church_id
    and p.role in ('admin', 'pastor')
  )
  or exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = peace_pairs.cell_id
    and (
      (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
    )
  )
);

-- Casas ------------------------------------------------------------------

drop policy if exists "peace_houses_select_by_responsibility" on public.peace_houses;
create policy "peace_houses_select_by_responsibility"
on public.peace_houses
for select
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = peace_houses.church_id
    and p.role in ('admin', 'pastor')
  )
  or exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = peace_houses.cell_id
    and (
      (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
    )
  )
);

drop policy if exists "peace_houses_insert_by_leadership" on public.peace_houses;
create policy "peace_houses_insert_by_leadership"
on public.peace_houses
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = peace_houses.church_id
    and p.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "peace_houses_update_by_responsibility" on public.peace_houses;
create policy "peace_houses_update_by_responsibility"
on public.peace_houses
for update
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = peace_houses.church_id
    and p.role in ('admin', 'pastor')
  )
  or exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = peace_houses.cell_id
    and (
      (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
    )
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = peace_houses.church_id
    and p.role in ('admin', 'pastor')
  )
  or exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = peace_houses.cell_id
    and (
      (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
    )
  )
);
