-- Ovelhas - Setup completo Supabase
-- Gerado para rodar no SQL Editor do Supabase.
-- Este arquivo consolida schema, funcoes, RLS, convites, discipulado, presenca, relatorios e configuracoes.
-- Rode em um projeto Supabase limpo ou em uma base Ovelhas existente para aplicar correcoes idempotentes.


-- ============================================================
-- schema.sql
-- ============================================================

-- Ovelhas - schema inicial Supabase
-- Rode este arquivo no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'pastor', 'supervisor', 'leader', 'consolidation', 'member');
  elsif not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role'
      and e.enumlabel = 'consolidation'
  ) then
    alter type app_role add value 'consolidation';
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

drop policy if exists "profiles_select_own_or_church_leadership" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
-- Policy segura por igreja e criada mais abaixo neste arquivo (depois que
-- current_app_church_id() existe). Ate la, profiles fica sem policy de select --
-- falha fechado, nao aberto.

drop policy if exists "cells_select_by_role" on public.cells;
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

drop policy if exists "people_select_by_responsibility" on public.people;
create policy "people_select_by_responsibility"
on public.people
for select
using (public.can_view_person(people));

drop policy if exists "people_insert_by_leadership" on public.people;
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

drop policy if exists "people_update_by_responsibility" on public.people;
create policy "people_update_by_responsibility"
on public.people
for update
using (public.can_view_person(people))
with check (public.can_view_person(people));

drop policy if exists "cell_reports_select_by_cell_access" on public.cell_reports;
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

drop policy if exists "cell_reports_insert_by_leader_or_admin" on public.cell_reports;
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
      or (p.role = 'supervisor' and p.id = c.supervisor_id)
    )
  )
);

-- ============================================================
-- bootstrap.sql
-- ============================================================

-- Ovelhas - primeira configuracao segura
-- Rode no SQL Editor depois de schema.sql e signup-profile.sql.
-- Esta funcao cria/promove o primeiro administrador somente se ainda nao existir admin.

drop policy if exists "churches_insert_authenticated" on public.churches;
drop policy if exists "churches_select_authenticated" on public.churches;
drop policy if exists "profiles_update_self_bootstrap" on public.profiles;
drop policy if exists "cells_insert_admin_or_pastor" on public.cells;
drop function if exists public.bootstrap_first_admin_by_email(text, text, text, text, text);
drop function if exists public.bootstrap_current_user_as_admin(text, text, text, text, text);

create or replace function public.bootstrap_first_admin(
  church_name text,
  church_city text default null,
  church_state text default null,
  admin_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_church_id uuid;
  admins_count integer;
begin
  if auth.uid() is null then
    raise exception 'Voce precisa estar logado para configurar o primeiro administrador.';
  end if;

  select count(*)
  into admins_count
  from public.profiles
  where role = 'admin'
  and church_id is not null;

  if admins_count > 0 then
    raise exception 'A primeira configuracao ja foi concluida. Peca acesso a um administrador.';
  end if;

  select id
  into target_church_id
  from public.churches
  order by created_at asc
  limit 1;

  if target_church_id is null then
    insert into public.churches (name, city, state)
    values (coalesce(nullif(church_name, ''), 'Igreja Central'), nullif(church_city, ''), nullif(church_state, ''))
    returning id into target_church_id;
  end if;

  insert into public.profiles (id, church_id, name, role)
  values (
    auth.uid(),
    target_church_id,
    coalesce(nullif(admin_name, ''), 'Administrador'),
    'admin'
  )
  on conflict (id) do update
  set
    church_id = excluded.church_id,
    name = excluded.name,
    role = 'admin';

  insert into public.cells (church_id, name, meeting_day, meeting_time, neighborhood, active)
  select target_church_id, 'Casa da Paz', 'Terca', '20h', 'Centro', true
  where not exists (
    select 1 from public.cells
    where church_id = target_church_id
    and name = 'Casa da Paz'
  );

  insert into public.cells (church_id, name, meeting_day, meeting_time, neighborhood, active)
  select target_church_id, 'Renovo', 'Quinta', '19h30', 'Vila Esperanca', true
  where not exists (
    select 1 from public.cells
    where church_id = target_church_id
    and name = 'Renovo'
  );

  return target_church_id;
end;
$$;

grant execute on function public.bootstrap_first_admin(text, text, text, text) to authenticated;

create or replace function public.current_app_user()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'church_id', p.church_id,
    'name', p.name,
    'role', p.role,
    'person_id', person_record.id,
    'cell_ids', coalesce(
      (
        select jsonb_agg(distinct cell_scope.cell_id)
        from (
          select c.id as cell_id
          from public.cells c
          where c.church_id = p.church_id
          and (c.leader_id = p.id or c.supervisor_id = p.id)

          union

          select person_record.cell_id
          where person_record.cell_id is not null
        ) cell_scope
      ),
      '[]'::jsonb
    )
  )
  into result
  from public.profiles p
  left join public.people person_record
    on person_record.person_user_id = p.id
    and person_record.church_id = p.church_id
  where p.id = auth.uid()
  limit 1;

  return result;
end;
$$;

grant execute on function public.current_app_user() to authenticated;

-- ============================================================
-- admin-management.sql
-- ============================================================

-- Ovelhas - administracao de acessos e cobertura pastoral
-- Rode este arquivo depois de schema.sql e bootstrap.sql.

create or replace function public.current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_app_church_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select church_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.can_manage_church(target_church_id uuid)
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
    and p.church_id = target_church_id
    and p.role in ('admin', 'pastor')
  )
$$;

create or replace function public.can_admin_church(target_church_id uuid)
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
    and p.church_id = target_church_id
    and p.role = 'admin'
  )
$$;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_app_church_id() to authenticated;
grant execute on function public.can_manage_church(uuid) to authenticated;
grant execute on function public.can_admin_church(uuid) to authenticated;

drop policy if exists "profiles_select_own_or_church_leadership" on public.profiles;
drop policy if exists "profiles_select_supervisor_or_leader_names" on public.profiles;
drop policy if exists "profiles_select_by_role_safe" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_by_church_safe"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or church_id = public.current_app_church_id()
);

drop policy if exists "cells_insert_admin_or_pastor" on public.cells;
drop policy if exists "cells_insert_by_operational_leadership" on public.cells;
create policy "cells_insert_by_operational_leadership"
on public.cells
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = cells.church_id
    and (
      p.role in ('admin', 'pastor')
      or (p.role = 'supervisor' and cells.supervisor_id = p.id)
    )
  )
);

drop policy if exists "cells_update_admin_or_pastor" on public.cells;
drop policy if exists "cells_update_by_operational_leadership" on public.cells;
create policy "cells_update_by_operational_leadership"
on public.cells
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = cells.church_id
    and (
      p.role in ('admin', 'pastor')
      or (p.role = 'supervisor' and cells.supervisor_id = p.id)
    )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = cells.church_id
    and (
      p.role in ('admin', 'pastor')
      or (p.role = 'supervisor' and cells.supervisor_id = p.id)
    )
  )
);

drop policy if exists "profiles_update_admin_or_pastor" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
using (public.can_admin_church(profiles.church_id))
with check (public.can_admin_church(profiles.church_id));

drop policy if exists "people_insert_by_leadership" on public.people;
drop policy if exists "people_insert_by_responsibility_safe" on public.people;
create policy "people_insert_by_responsibility_safe"
on public.people
for insert
with check (
  exists (
    select 1
    from public.profiles p
    left join public.cells c on c.id = people.cell_id
    where p.id = auth.uid()
    and p.church_id = people.church_id
    and (
      p.role in ('admin', 'pastor')
      or (p.role = 'leader' and c.leader_id = p.id)
      or (p.role = 'supervisor' and c.supervisor_id = p.id)
    )
  )
);

drop policy if exists "people_update_by_responsibility" on public.people;
drop policy if exists "people_update_by_responsibility_safe" on public.people;
create policy "people_update_by_responsibility_safe"
on public.people
for update
using (public.can_view_person(people))
with check (
  exists (
    select 1
    from public.profiles p
    left join public.cells c on c.id = people.cell_id
    where p.id = auth.uid()
    and p.church_id = people.church_id
    and (
      p.role in ('admin', 'pastor')
      or (p.role = 'leader' and (c.leader_id = p.id or people.leader_user_id = p.id))
      or (p.role = 'supervisor' and c.supervisor_id = p.id)
      or people.person_user_id = p.id
    )
  )
);

-- ============================================================
-- invites.sql
-- ============================================================

-- Ovelhas - convites por link
-- Rode depois de schema.sql e admin-management.sql.

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  token text not null unique,
  email text,
  name text,
  role app_role not null default 'member',
  cell_id uuid references public.cells(id) on delete set null,
  created_by uuid references public.profiles(id),
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

create or replace function public.can_admin_church(target_church_id uuid)
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
    and p.church_id = target_church_id
    and p.role = 'admin'
  )
$$;

grant execute on function public.can_admin_church(uuid) to authenticated;

drop function if exists public.can_create_invite(uuid, app_role, uuid);
create or replace function public.can_create_invite(
  target_church_id uuid,
  target_role app_role,
  target_cell_id uuid
)
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
    and p.church_id = target_church_id
    and (
      (
        p.role = 'admin'
        and (
          target_role in ('admin', 'pastor', 'supervisor')
          or exists (
            select 1
            from public.cells c
            where c.id = target_cell_id
            and c.church_id = target_church_id
          )
        )
      )
      or (
        p.role = 'pastor'
        and (
          target_role = 'supervisor'
          or (
            target_role in ('leader', 'member')
            and exists (
              select 1
              from public.cells c
              where c.id = target_cell_id
              and c.church_id = target_church_id
            )
          )
        )
      )
      or (
        p.role = 'supervisor'
        and target_role in ('leader', 'member')
        and exists (
          select 1
          from public.cells c
          where c.id = target_cell_id
          and c.church_id = target_church_id
          and c.supervisor_id = p.id
        )
      )
      or (
        p.role = 'leader'
        and target_role = 'member'
        and exists (
          select 1
          from public.cells c
          where c.id = target_cell_id
          and c.church_id = target_church_id
          and c.leader_id = p.id
        )
      )
    )
  )
$$;

drop policy if exists "invites_select_by_token_or_leadership" on public.invites;
drop policy if exists "invites_select_by_leadership" on public.invites;
drop function if exists public.can_view_invite(uuid, uuid);
create or replace function public.can_view_invite(target_church_id uuid, target_created_by uuid, target_cell_id uuid)
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
    and p.church_id = target_church_id
    and (
      p.role in ('admin', 'pastor')
      or p.id = target_created_by
      or (
        p.role = 'supervisor'
        and exists (
          select 1
          from public.cells c
          where c.id = target_cell_id
          and c.church_id = target_church_id
          and c.supervisor_id = p.id
        )
      )
    )
  )
$$;

grant execute on function public.can_create_invite(uuid, app_role, uuid) to authenticated;
grant execute on function public.can_view_invite(uuid, uuid, uuid) to anon, authenticated;

drop policy if exists "invites_select_by_leadership" on public.invites;
create policy "invites_select_by_leadership"
on public.invites
for select
using (public.can_view_invite(invites.church_id, invites.created_by, invites.cell_id));

create or replace function public.get_invite_by_token(invite_token text)
returns table (
  id uuid,
  church_id uuid,
  token text,
  email text,
  name text,
  role app_role,
  cell_id uuid,
  created_by uuid,
  status text,
  expires_at timestamptz,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.church_id,
    i.token,
    i.email,
    i.name,
    i.role,
    i.cell_id,
    i.created_by,
    i.status,
    i.expires_at,
    i.accepted_by,
    i.accepted_at,
    i.created_at
  from public.invites i
  where i.token = invite_token
  and i.status = 'pending'
  and i.expires_at > now()
  limit 1
$$;

grant execute on function public.get_invite_by_token(text) to anon, authenticated;

drop policy if exists "invites_insert_by_leadership" on public.invites;
create policy "invites_insert_by_leadership"
on public.invites
for insert
with check (public.can_create_invite(invites.church_id, invites.role, invites.cell_id));

drop policy if exists "invites_update_by_admin_or_creator" on public.invites;
create policy "invites_update_by_admin_or_creator"
on public.invites
for update
using (
  created_by = auth.uid()
  or public.can_admin_church(invites.church_id)
)
with check (
  created_by = auth.uid()
  or public.can_admin_church(invites.church_id)
);

create or replace function public.accept_invite(invite_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  perform public.accept_invite_for_user(auth.uid(), null, invite_token);
end;
$$;

create or replace function public.accept_invite_for_user(
  target_user_id uuid,
  target_email text,
  invite_token text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_invite public.invites;
  auth_email text;
  existing_person_id uuid;
  profile_name text;
  target_leader_id uuid;
begin
  if target_user_id is null then
    raise exception 'Usuario nao informado.';
  end if;

  select *
  into target_invite
  from public.invites
  where token = invite_token
  limit 1;

  if target_invite.id is null then
    raise exception 'Convite invalido.';
  end if;

  if target_invite.status = 'accepted' and target_invite.accepted_by = target_user_id then
    return;
  end if;

  if target_invite.status <> 'pending' or target_invite.expires_at <= now() then
    raise exception 'Convite invalido ou expirado.';
  end if;

  select coalesce(target_email, email)
  into auth_email
  from auth.users
  where id = target_user_id;

  if target_invite.email is not null and target_invite.email <> '' and lower(target_invite.email) <> lower(auth_email) then
    raise exception 'Este convite pertence a outro email.';
  end if;

  select coalesce(
    nullif(target_invite.name, ''),
    nullif(raw_user_meta_data->>'name', ''),
    split_part(auth_email, '@', 1),
    'Novo membro'
  )
  into profile_name
  from auth.users
  where id = target_user_id;

  insert into public.profiles (id, church_id, name, role)
  values (
    target_user_id,
    target_invite.church_id,
    profile_name,
    target_invite.role
  )
  on conflict (id) do update
  set
    church_id = excluded.church_id,
    name = excluded.name,
    role = excluded.role;

  if target_invite.role = 'leader' and target_invite.cell_id is not null then
    update public.cells
    set leader_id = target_user_id
    where id = target_invite.cell_id
    and church_id = target_invite.church_id;
  end if;

  if target_invite.role = 'member' then
    select c.leader_id
    into target_leader_id
    from public.cells c
    where c.id = target_invite.cell_id
    and c.church_id = target_invite.church_id
    limit 1;

    select id
    into existing_person_id
    from public.people
    where person_user_id = target_user_id
    or (target_invite.email is not null and email = target_invite.email and church_id = target_invite.church_id)
    limit 1;

    if existing_person_id is null then
      insert into public.people (
        church_id,
        cell_id,
        person_user_id,
        created_by_user_id,
        leader_user_id,
        name,
        email,
        status,
        journey_stage,
        first_visit_date
      )
      values (
        target_invite.church_id,
        target_invite.cell_id,
        target_user_id,
        target_invite.created_by,
        coalesce(target_leader_id, target_invite.created_by),
        coalesce(nullif(target_invite.name, ''), auth_email),
        auth_email,
        'Novo membro',
        'Primeiros passos',
        current_date
      );
    else
      update public.people
      set
        person_user_id = target_user_id,
        cell_id = coalesce(cell_id, target_invite.cell_id),
        leader_user_id = coalesce(leader_user_id, target_leader_id, target_invite.created_by)
      where id = existing_person_id;
    end if;
  end if;

  update public.invites
  set
    status = 'accepted',
    accepted_by = target_user_id,
    accepted_at = now()
  where id = target_invite.id;
end;
$$;

grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.accept_invite_for_user(uuid, text, text) to authenticated;

-- ============================================================
-- signup-profile.sql
-- ============================================================

-- Ovelhas - complemento para cadastro via Supabase Auth
-- Rode no SQL Editor depois do schema.sql.
-- Contas criadas diretamente ficam sem church_id.
-- No app isso significa "aguardando liberacao": a pessoa nao acessa dados da igreja
-- ate aceitar um convite ou ser vinculada por um administrador.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Novo membro'),
    'member'
  )
  on conflict (id) do nothing;

  if new.raw_user_meta_data ? 'invite_token' then
    perform public.accept_invite_for_user(new.id, new.email, new.raw_user_meta_data->>'invite_token');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- accountability.sql
-- ============================================================

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

-- ============================================================
-- attendance.sql
-- ============================================================

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

-- ============================================================
-- cell-rsvps.sql
-- ============================================================

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

-- ============================================================
-- checkins.sql
-- ============================================================

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

-- ============================================================
-- discipleship.sql
-- ============================================================

-- Ovelhas - trilhas, videos, liberacao e progresso de discipulado
-- Rode depois de schema.sql, admin-management.sql e attendance.sql.

drop policy if exists "discipleship_tracks_select_by_church" on public.discipleship_tracks;
create policy "discipleship_tracks_select_by_church"
on public.discipleship_tracks
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = discipleship_tracks.church_id
  )
);

drop policy if exists "discipleship_tracks_insert_by_admin_or_pastor" on public.discipleship_tracks;
create policy "discipleship_tracks_insert_by_admin_or_pastor"
on public.discipleship_tracks
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = discipleship_tracks.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "discipleship_tracks_update_by_admin_or_pastor" on public.discipleship_tracks;
create policy "discipleship_tracks_update_by_admin_or_pastor"
on public.discipleship_tracks
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = discipleship_tracks.church_id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = discipleship_tracks.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "discipleship_tracks_delete_by_admin_or_pastor" on public.discipleship_tracks;
create policy "discipleship_tracks_delete_by_admin_or_pastor"
on public.discipleship_tracks
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = discipleship_tracks.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "discipleship_videos_select_by_track_church" on public.discipleship_videos;
create policy "discipleship_videos_select_by_track_church"
on public.discipleship_videos
for select
using (
  exists (
    select 1
    from public.discipleship_tracks t
    join public.profiles p on p.id = auth.uid()
    where t.id = discipleship_videos.track_id
    and p.church_id = t.church_id
  )
);

drop policy if exists "discipleship_videos_insert_by_admin_or_pastor" on public.discipleship_videos;
create policy "discipleship_videos_insert_by_admin_or_pastor"
on public.discipleship_videos
for insert
with check (
  exists (
    select 1
    from public.discipleship_tracks t
    join public.profiles p on p.id = auth.uid()
    where t.id = discipleship_videos.track_id
    and p.church_id = t.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "discipleship_videos_update_by_admin_or_pastor" on public.discipleship_videos;
create policy "discipleship_videos_update_by_admin_or_pastor"
on public.discipleship_videos
for update
using (
  exists (
    select 1
    from public.discipleship_tracks t
    join public.profiles p on p.id = auth.uid()
    where t.id = discipleship_videos.track_id
    and p.church_id = t.church_id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  exists (
    select 1
    from public.discipleship_tracks t
    join public.profiles p on p.id = auth.uid()
    where t.id = discipleship_videos.track_id
    and p.church_id = t.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "discipleship_videos_delete_by_admin_or_pastor" on public.discipleship_videos;
create policy "discipleship_videos_delete_by_admin_or_pastor"
on public.discipleship_videos
for delete
using (
  exists (
    select 1
    from public.discipleship_tracks t
    join public.profiles p on p.id = auth.uid()
    where t.id = discipleship_videos.track_id
    and p.church_id = t.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "person_track_access_select_by_responsibility" on public.person_track_access;
create policy "person_track_access_select_by_responsibility"
on public.person_track_access
for select
using (
  exists (
    select 1
    from public.people person
    where person.id = person_track_access.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "person_track_access_insert_by_leadership" on public.person_track_access;
create policy "person_track_access_insert_by_leadership"
on public.person_track_access
for insert
with check (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = person_track_access.person_id
    and (
      (p.role in ('admin', 'pastor') and p.church_id = person.church_id)
      or (
        p.role = 'supervisor'
        and exists (
          select 1
          from public.cells c
          where c.id = person.cell_id
          and c.supervisor_id = p.id
        )
      )
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

drop policy if exists "video_progress_select_by_responsibility" on public.video_progress;
create policy "video_progress_select_by_responsibility"
on public.video_progress
for select
using (
  exists (
    select 1
    from public.people person
    where person.id = video_progress.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "video_progress_upsert_by_member_or_leader" on public.video_progress;
create policy "video_progress_upsert_by_member_or_leader"
on public.video_progress
for insert
with check (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = video_progress.person_id
    and (
      person.person_user_id = p.id
      or (p.role in ('admin', 'pastor') and p.church_id = person.church_id)
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

drop policy if exists "video_progress_update_by_member_or_leader" on public.video_progress;
create policy "video_progress_update_by_member_or_leader"
on public.video_progress
for update
using (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = video_progress.person_id
    and (
      person.person_user_id = p.id
      or (p.role in ('admin', 'pastor') and p.church_id = person.church_id)
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
)
with check (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = video_progress.person_id
    and (
      person.person_user_id = p.id
      or (p.role in ('admin', 'pastor') and p.church_id = person.church_id)
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

create table if not exists public.video_reflections (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  video_id uuid not null references public.discipleship_videos(id) on delete cascade,
  question text not null default 'Reflexao',
  answer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, video_id, question)
);

alter table public.video_reflections enable row level security;

drop policy if exists "video_reflections_select_by_responsibility" on public.video_reflections;
create policy "video_reflections_select_by_responsibility"
on public.video_reflections
for select
using (
  exists (
    select 1
    from public.people person
    where person.id = video_reflections.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "video_reflections_upsert_by_member_or_leader" on public.video_reflections;
create policy "video_reflections_upsert_by_member_or_leader"
on public.video_reflections
for insert
with check (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = video_reflections.person_id
    and (
      person.person_user_id = p.id
      or (p.role in ('admin', 'pastor') and p.church_id = person.church_id)
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

drop policy if exists "video_reflections_update_by_member_or_leader" on public.video_reflections;
create policy "video_reflections_update_by_member_or_leader"
on public.video_reflections
for update
using (
  exists (
    select 1
    from public.people person
    where person.id = video_reflections.person_id
    and public.can_view_person(person)
  )
)
with check (
  exists (
    select 1
    from public.people person
    where person.id = video_reflections.person_id
    and public.can_view_person(person)
  )
);

-- ============================================================
-- person-profile.sql
-- ============================================================

-- Ovelhas - perfil completo, notas pastorais e historico
-- Rode depois de schema.sql e admin-management.sql.

create table if not exists public.pastoral_notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  created_by uuid references public.profiles(id),
  note text not null,
  visibility text not null default 'leadership_private',
  created_at timestamptz not null default now()
);

alter table public.pastoral_notes enable row level security;

drop policy if exists "pastoral_notes_select_by_visibility" on public.pastoral_notes;
create policy "pastoral_notes_select_by_visibility"
on public.pastoral_notes
for select
using (
  exists (
    select 1
    from public.people person
    join public.profiles viewer on viewer.id = auth.uid()
    where person.id = pastoral_notes.person_id
    and public.can_view_person(person)
    and (
      pastoral_notes.visibility = 'member_visible'
      or (
        pastoral_notes.visibility = 'pastor_private'
        and viewer.role in ('admin', 'pastor')
      )
      or (
        pastoral_notes.visibility = 'leadership_private'
        and viewer.role in ('admin', 'pastor', 'supervisor', 'leader')
      )
    )
  )
);

drop policy if exists "pastoral_notes_insert_by_leadership" on public.pastoral_notes;
create policy "pastoral_notes_insert_by_leadership"
on public.pastoral_notes
for insert
with check (
  exists (
    select 1
    from public.people person
    join public.profiles viewer on viewer.id = auth.uid()
    where person.id = pastoral_notes.person_id
    and public.can_view_person(person)
    and viewer.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "people_update_profile_by_responsibility" on public.people;
create policy "people_update_profile_by_responsibility"
on public.people
for update
using (public.can_view_person(people))
with check (public.can_view_person(people));

drop policy if exists "people_delete_by_responsibility" on public.people;
create policy "people_delete_by_responsibility"
on public.people
for delete
using (
  public.can_view_person(people)
  and exists (
    select 1
    from public.profiles viewer
    where viewer.id = auth.uid()
    and viewer.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

-- ============================================================
-- pastoral-agenda.sql
-- ============================================================

-- Ovelhas - agenda pastoral e lembretes
-- Rode depois de schema.sql e person-profile.sql.

create table if not exists public.pastoral_reminders (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  reminder_type text not null default 'outro',
  due_at timestamptz not null,
  status text not null default 'open',
  person_id uuid references public.people(id) on delete set null,
  cell_id uuid references public.cells(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.pastoral_reminders enable row level security;

drop policy if exists "pastoral_reminders_select_by_responsibility" on public.pastoral_reminders;
create policy "pastoral_reminders_select_by_responsibility"
on public.pastoral_reminders
for select
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = pastoral_reminders.church_id
    and p.role in ('admin', 'pastor')
  )
  or exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = pastoral_reminders.cell_id
    and (
      (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
    )
  )
  or exists (
    select 1
    from public.people person
    where person.id = pastoral_reminders.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "pastoral_reminders_insert_by_leadership" on public.pastoral_reminders;
create policy "pastoral_reminders_insert_by_leadership"
on public.pastoral_reminders
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = pastoral_reminders.church_id
    and p.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "pastoral_reminders_update_by_responsibility" on public.pastoral_reminders;
create policy "pastoral_reminders_update_by_responsibility"
on public.pastoral_reminders
for update
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = pastoral_reminders.church_id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = pastoral_reminders.church_id
    and p.role in ('admin', 'pastor')
  )
);

-- ============================================================
-- prayer-requests.sql
-- ============================================================

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

-- ============================================================
-- library-certificates.sql
-- ============================================================

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

-- ============================================================
-- church-settings.sql
-- ============================================================

-- Ovelhas - configuracoes avancadas da igreja
-- Rode depois de schema.sql e admin-management.sql.

create table if not exists public.church_settings (
  church_id uuid primary key references public.churches(id) on delete cascade,
  logo_url text,
  primary_color text not null default '#064e3b',
  welcome_message text,
  absence_message text,
  discipleship_message text,
  privacy_contact text,
  terms_text text,
  updated_at timestamptz not null default now()
);

alter table public.church_settings enable row level security;

drop policy if exists "church_settings_select_by_church" on public.church_settings;
create policy "church_settings_select_by_church"
on public.church_settings
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_settings.church_id
  )
);

drop policy if exists "church_settings_upsert_by_admin_or_pastor" on public.church_settings;
drop policy if exists "church_settings_upsert_by_admin" on public.church_settings;
create policy "church_settings_upsert_by_admin_or_pastor"
on public.church_settings
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_settings.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "church_settings_update_by_admin_or_pastor" on public.church_settings;
drop policy if exists "church_settings_update_by_admin" on public.church_settings;
create policy "church_settings_update_by_admin_or_pastor"
on public.church_settings
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_settings.church_id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_settings.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "churches_select_same_church" on public.churches;
create policy "churches_select_same_church"
on public.churches
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = churches.id
  )
);

drop policy if exists "churches_update_admin_or_pastor" on public.churches;
drop policy if exists "churches_update_admin" on public.churches;
create policy "churches_update_admin_or_pastor"
on public.churches
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = churches.id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = churches.id
    and p.role in ('admin', 'pastor')
  )
);

-- ============================================================
-- checkin-attendance.sql
-- ============================================================

-- Ovelhas - conecta check-in por QR a presenca real
-- Sem isso, quem faz check-in continua aparecendo como ausente para o lider.

create or replace function public.record_checkin_attendance(
  p_cell_id uuid,
  p_person_id uuid,
  p_checkin_type text,
  p_checkin_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_cell public.cells;
  target_person public.people;
  meeting_id uuid;
  service_id uuid;
  authorized boolean;
begin
  if auth.uid() is null or p_person_id is null then
    return;
  end if;

  select * into target_cell from public.cells where id = p_cell_id;
  if target_cell.id is null then
    return;
  end if;

  select * into target_person from public.people where id = p_person_id and church_id = target_cell.church_id;
  if target_person.id is null then
    return;
  end if;

  authorized := target_person.person_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and p.church_id = target_cell.church_id
      and (
        p.role in ('admin', 'pastor')
        or (p.role = 'supervisor' and target_cell.supervisor_id = p.id)
        or (p.role = 'leader' and target_cell.leader_id = p.id)
      )
    );

  if not authorized then
    return;
  end if;

  if p_checkin_type = 'service' then
    select id into service_id
    from public.church_services
    where church_id = target_cell.church_id and service_date = p_checkin_date
    limit 1;

    if service_id is null then
      insert into public.church_services (church_id, service_date, created_by)
      values (target_cell.church_id, p_checkin_date, auth.uid())
      returning id into service_id;
    end if;

    insert into public.service_attendance (service_id, person_id, present)
    values (service_id, p_person_id, true)
    on conflict (service_id, person_id) do update set present = true;

    return;
  end if;

  select id into meeting_id
  from public.cell_meetings
  where cell_id = p_cell_id and meeting_date = p_checkin_date
  limit 1;

  if meeting_id is null then
    insert into public.cell_meetings (cell_id, meeting_date, created_by)
    values (p_cell_id, p_checkin_date, auth.uid())
    returning id into meeting_id;
  end if;

  insert into public.cell_attendance (meeting_id, person_id, present)
  values (meeting_id, p_person_id, true)
  on conflict (meeting_id, person_id) do update set present = true;
end;
$$;

grant execute on function public.record_checkin_attendance(uuid, uuid, text, date) to authenticated;

-- ============================================================
-- peace-homes.sql
-- ============================================================

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

-- ============================================================
-- media-storage.sql
-- ============================================================

-- Ovelhas - storage real para foto de perfil e midia de avisos
-- Sem isso, fotos e midias de avisos ficam em base64 dentro das tabelas, o que nao escala.

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('notice-media', 'notice-media', true)
on conflict (id) do nothing;

drop policy if exists "profile_photos_public_read" on storage.objects;
create policy "profile_photos_public_read"
on storage.objects
for select
using (bucket_id = 'profile-photos');

drop policy if exists "profile_photos_insert_own" on storage.objects;
create policy "profile_photos_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_photos_update_own" on storage.objects;
create policy "profile_photos_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "notice_media_public_read" on storage.objects;
create policy "notice_media_public_read"
on storage.objects
for select
using (bucket_id = 'notice-media');

drop policy if exists "notice_media_insert_leadership" on storage.objects;
create policy "notice_media_insert_leadership"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'notice-media'
  and (storage.foldername(name))[1] = public.current_app_church_id()::text
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'pastor', 'supervisor', 'leader', 'communication')
  )
);

-- ============================================================
-- subscriptions.sql
-- ============================================================

-- Ovelhas - assinaturas por igreja (Stripe)
-- Escrita nesta tabela so acontece pelo webhook (service role, bypassa RLS).
-- O cliente nunca escreve aqui diretamente.

create table if not exists public.church_subscriptions (
  church_id uuid primary key references public.churches(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  tier text check (tier in ('pequena', 'media', 'grande')),
  status text not null default 'incomplete' check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')
  ),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.church_subscriptions enable row level security;

drop policy if exists "church_subscriptions_select_by_leadership" on public.church_subscriptions;
create policy "church_subscriptions_select_by_leadership"
on public.church_subscriptions
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_subscriptions.church_id
    and p.role in ('admin', 'pastor')
  )
);
