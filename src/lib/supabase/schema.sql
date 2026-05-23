-- Ovelhas - schema inicial Supabase
-- Rode este arquivo no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'pastor', 'supervisor', 'leader', 'member');
  end if;
end $$;

create table if not exists public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  state text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  church_id uuid references public.churches(id) on delete cascade,
  name text not null,
  phone text,
  role app_role not null default 'member',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.cells (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null,
  leader_id uuid references public.profiles(id),
  supervisor_id uuid references public.profiles(id),
  meeting_day text,
  meeting_time text,
  address text,
  neighborhood text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  cell_id uuid references public.cells(id) on delete set null,
  person_user_id uuid references public.profiles(id) on delete set null,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  leader_user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  email text,
  birth_date date,
  address text,
  neighborhood text,
  status text not null default 'Visitante',
  journey_stage text not null default 'Primeiro contato',
  first_visit_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cell_meetings (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(id) on delete cascade,
  meeting_date date not null,
  notes text,
  visitors_count integer not null default 0,
  decisions_count integer not null default 0,
  prayer_requests text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.cell_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.cell_meetings(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  present boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (meeting_id, person_id)
);

create table if not exists public.cell_reports (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  cell_id uuid not null references public.cells(id) on delete cascade,
  leader_id uuid references public.profiles(id),
  supervisor_id uuid references public.profiles(id),
  meeting_date date not null,
  present_count integer not null default 0,
  visitors_count integer not null default 0,
  service_count integer not null default 0,
  decisions_count integer not null default 0,
  highlights text,
  needs text,
  prayer_requests text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.discipleship_tracks (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.discipleship_videos (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.discipleship_tracks(id) on delete cascade,
  title text not null,
  description text,
  video_url text not null,
  thumbnail_url text,
  duration_seconds integer,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.person_track_access (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  track_id uuid not null references public.discipleship_tracks(id) on delete cascade,
  released_by uuid references public.profiles(id),
  status text not null default 'active',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (person_id, track_id)
);

create table if not exists public.video_progress (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  video_id uuid not null references public.discipleship_videos(id) on delete cascade,
  status text not null default 'not_started',
  progress_percent integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  last_watched_at timestamptz,
  unique (person_id, video_id)
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  assigned_to uuid references public.profiles(id),
  type text not null,
  priority text not null default 'Media',
  title text not null,
  description text,
  status text not null default 'open',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.churches enable row level security;
alter table public.profiles enable row level security;
alter table public.cells enable row level security;
alter table public.people enable row level security;
alter table public.cell_meetings enable row level security;
alter table public.cell_attendance enable row level security;
alter table public.cell_reports enable row level security;
alter table public.discipleship_tracks enable row level security;
alter table public.discipleship_videos enable row level security;
alter table public.person_track_access enable row level security;
alter table public.video_progress enable row level security;
alter table public.follow_ups enable row level security;

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.can_view_person(target public.people)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and (
      (p.role in ('admin', 'pastor') and p.church_id = target.church_id)
      or (
        p.role = 'supervisor'
        and exists (
          select 1
          from public.cells c
          where c.id = target.cell_id
          and c.supervisor_id = p.id
        )
      )
      or (
        p.role = 'leader'
        and (
          target.leader_user_id = p.id
          or target.created_by_user_id = p.id
          or exists (
            select 1
            from public.cells c
            where c.id = target.cell_id
            and c.leader_id = p.id
          )
        )
      )
      or (p.role = 'member' and target.person_user_id = p.id)
    )
  )
$$;

create policy "profiles_select_own_or_church_leadership"
on public.profiles
for select
using (
  id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'pastor')
    and p.church_id = profiles.church_id
  )
);

create policy "cells_select_by_role"
on public.cells
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and (
      (p.role in ('admin', 'pastor') and p.church_id = cells.church_id)
      or (p.role = 'supervisor' and p.id = cells.supervisor_id)
      or (p.role = 'leader' and p.id = cells.leader_id)
    )
  )
);

create policy "people_select_by_responsibility"
on public.people
for select
using (public.can_view_person(people));

create policy "people_insert_by_leadership"
on public.people
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'pastor', 'leader')
    and p.church_id = people.church_id
  )
);

create policy "people_update_by_responsibility"
on public.people
for update
using (public.can_view_person(people))
with check (public.can_view_person(people));

create policy "cell_reports_select_by_cell_access"
on public.cell_reports
for select
using (
  exists (
    select 1 from public.cells c
    where c.id = cell_reports.cell_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (
        (p.role in ('admin', 'pastor') and p.church_id = c.church_id)
        or (p.role = 'supervisor' and p.id = c.supervisor_id)
        or (p.role = 'leader' and p.id = c.leader_id)
      )
    )
  )
);

create policy "cell_reports_insert_by_leader_or_admin"
on public.cell_reports
for insert
with check (
  exists (
    select 1 from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = cell_reports.cell_id
    and (
      (p.role in ('admin', 'pastor') and p.church_id = c.church_id)
      or (p.role = 'leader' and p.id = c.leader_id)
    )
  )
);
