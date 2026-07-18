-- Ovelhas - atualizacao de producao
-- Rode este arquivo no Supabase SQL Editor depois do deploy.
-- Ele presume que o schema principal do Ovelhas ja existe.

alter table public.consolidation_reports
  add column if not exists ministry_counts jsonb not null default '{}'::jsonb,
  add column if not exists temple_count integer not null default 0,
  add column if not exists kids_count integer not null default 0,
  add column if not exists baby_count integer not null default 0,
  add column if not exists vagalumes_count integer not null default 0;

alter table public.consolidation_visitors
  add column if not exists age integer;

alter table public.people
  add column if not exists photo_url text,
  add column if not exists family_phone text;

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
    left join public.people member_person on member_person.person_user_id = p.id
    where p.id = auth.uid()
    and (
      (p.role in ('admin', 'pastor') and p.church_id = activity_events.church_id and activity_events.visibility <> 'member')
      or (p.role = 'supervisor' and (p.id = c.supervisor_id or p.id = activity_events.actor_user_id))
      or (p.role = 'leader' and (p.id = c.leader_id or p.id = pe.leader_user_id or p.id = activity_events.actor_user_id))
      or (
        p.role = 'member'
        and activity_events.visibility = 'member'
        and (
          p.id = activity_events.actor_user_id
          or p.id = pe.person_user_id
          or member_person.cell_id = activity_events.cell_id
        )
      )
    )
  )
);

alter table public.invites
  add column if not exists person_id uuid references public.people(id) on delete set null;

drop function if exists public.create_invite_for_person(text, text, text, app_role, uuid, uuid, timestamptz);
create or replace function public.create_invite_for_person(
  invite_token text,
  invite_email text default null,
  invite_name text default null,
  invite_role app_role default 'member',
  invite_cell_id uuid default null,
  invite_person_id uuid default null,
  invite_expires_at timestamptz default null
)
returns table (
  id uuid,
  church_id uuid,
  token text,
  email text,
  name text,
  role app_role,
  cell_id uuid,
  person_id uuid,
  created_by uuid,
  status text,
  expires_at timestamptz,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  viewer public.profiles%rowtype;
  target_person public.people%rowtype;
  created_invite public.invites%rowtype;
  target_cell_id uuid;
begin
  select *
  into viewer
  from public.profiles
  where profiles.id = auth.uid()
  limit 1;

  if viewer.id is null or viewer.church_id is null then
    raise exception 'Usuario sem igreja vinculada.';
  end if;

  if invite_person_id is not null then
    select *
    into target_person
    from public.people
    where people.id = invite_person_id
    and people.church_id = viewer.church_id
    limit 1;

    if target_person.id is null then
      raise exception 'Pessoa nao encontrada para este convite.';
    end if;
  end if;

  target_cell_id := coalesce(invite_cell_id, target_person.cell_id);

  if invite_role::text in ('leader', 'member') and target_cell_id is null then
    raise exception 'Escolha uma celula para este convite.';
  end if;

  if not public.can_create_invite(viewer.church_id, invite_role, target_cell_id) then
    raise exception 'Seu acesso nao permite criar este convite.';
  end if;

  insert into public.invites (
    church_id,
    token,
    email,
    name,
    role,
    cell_id,
    person_id,
    created_by,
    status,
    expires_at
  )
  values (
    viewer.church_id,
    invite_token,
    nullif(trim(coalesce(invite_email, target_person.email, '')), ''),
    nullif(trim(coalesce(invite_name, target_person.name, '')), ''),
    invite_role,
    target_cell_id,
    invite_person_id,
    viewer.id,
    'pending',
    coalesce(invite_expires_at, now() + interval '14 days')
  )
  returning *
  into created_invite;

  return query
  select created_invite.id, created_invite.church_id, created_invite.token, created_invite.email,
         created_invite.name, created_invite.role, created_invite.cell_id, created_invite.person_id,
         created_invite.created_by, created_invite.status, created_invite.expires_at,
         created_invite.accepted_by, created_invite.accepted_at, created_invite.created_at;
end;
$$;

drop function if exists public.accept_invite_for_user(uuid, text, text);
create or replace function public.accept_invite_for_user(
  target_user_id uuid,
  auth_email text,
  invite_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  target_invite public.invites%rowtype;
  existing_profile public.profiles%rowtype;
  existing_person_id uuid;
  target_leader_id uuid;
begin
  select *
  into target_invite
  from public.invites
  where token = invite_token
  limit 1;

  if target_invite.id is null then
    raise exception 'Convite nao encontrado.';
  end if;

  if target_invite.status = 'accepted' and target_invite.accepted_by = target_user_id then
    return true;
  end if;

  if target_invite.status <> 'pending' or target_invite.expires_at <= now() then
    raise exception 'Convite expirado ou ja usado.';
  end if;

  if target_invite.email is not null
    and target_invite.email <> ''
    and auth_email is not null
    and lower(target_invite.email) <> lower(auth_email)
  then
    raise exception 'Este convite pertence a outro email.';
  end if;

  select *
  into existing_profile
  from public.profiles
  where id = target_user_id
  limit 1;

  insert into public.profiles (id, church_id, name, role)
  values (
    target_user_id,
    target_invite.church_id,
    coalesce(nullif(target_invite.name, ''), nullif(auth_email, ''), 'Novo usuario'),
    target_invite.role
  )
  on conflict (id) do update
  set church_id = excluded.church_id,
      name = coalesce(nullif(excluded.name, ''), public.profiles.name),
      role = excluded.role;

  if target_invite.role::text = 'leader' and target_invite.cell_id is not null then
    update public.cells
    set leader_id = target_user_id
    where id = target_invite.cell_id
      and church_id = target_invite.church_id;
  end if;

  if target_invite.role::text = 'supervisor' and target_invite.cell_id is not null then
    update public.cells
    set supervisor_id = target_user_id
    where id = target_invite.cell_id
      and church_id = target_invite.church_id;
  end if;

  if target_invite.role::text = 'member' then
    select coalesce(c.leader_id, target_invite.created_by)
    into target_leader_id
    from public.cells c
    where c.id = target_invite.cell_id
      and c.church_id = target_invite.church_id
    limit 1;

    select id
    into existing_person_id
    from public.people
    where (
      id = target_invite.person_id
      or person_user_id = target_user_id
      or (target_invite.email is not null and email = target_invite.email and church_id = target_invite.church_id)
    )
    and church_id = target_invite.church_id
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
        coalesce(nullif(target_invite.name, ''), nullif(auth_email, ''), 'Novo membro'),
        auth_email,
        'Novo membro',
        'Primeiros passos',
        current_date
      );
    else
      update public.people
      set
        person_user_id = target_user_id,
        cell_id = coalesce(target_invite.cell_id, cell_id),
        leader_user_id = coalesce(target_leader_id, target_invite.created_by, leader_user_id),
        email = coalesce(nullif(auth_email, ''), email),
        name = coalesce(nullif(target_invite.name, ''), name),
        status = case when status = 'Visitante' then 'Novo membro' else status end,
        journey_stage = case when journey_stage = 'Visitante' then 'Primeiros passos' else journey_stage end
      where id = existing_person_id;
    end if;
  end if;

  update public.invites
  set status = 'accepted',
      accepted_by = target_user_id,
      accepted_at = now()
  where id = target_invite.id;

  return true;
end;
$$;

grant execute on function public.create_invite_for_person(text, text, text, app_role, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.accept_invite_for_user(uuid, text, text) to authenticated;

drop policy if exists "consolidation_visitors_update_by_role" on public.consolidation_visitors;
create policy "consolidation_visitors_update_by_role"
on public.consolidation_visitors
for update
using (
  church_id = public.current_app_church_id()
  and public.current_app_role()::text in ('admin', 'pastor', 'consolidation')
)
with check (
  church_id = public.current_app_church_id()
  and public.current_app_role()::text in ('admin', 'pastor', 'consolidation')
);

grant update on public.consolidation_visitors to authenticated;

create index if not exists idx_profiles_church_role on public.profiles(church_id, role);
create index if not exists idx_cells_church_active on public.cells(church_id, active);
create index if not exists idx_people_church_cell on public.people(church_id, cell_id);
create index if not exists idx_people_church_leader on public.people(church_id, leader_user_id);
create index if not exists idx_invites_church_status on public.invites(church_id, status);
create index if not exists idx_consolidation_reports_church_date on public.consolidation_reports(church_id, service_date desc);
create index if not exists idx_consolidation_visitors_church_created on public.consolidation_visitors(church_id, created_at desc);
create index if not exists idx_activity_events_church_created on public.activity_events(church_id, created_at desc);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.platform_admins admin_scope
    where admin_scope.user_id = auth.uid()
  )
$$;

grant execute on function public.is_platform_admin() to authenticated;

drop policy if exists "platform_admins_select_self_or_platform" on public.platform_admins;
create policy "platform_admins_select_self_or_platform"
on public.platform_admins
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
);

grant select on public.platform_admins to authenticated;

create or replace function public.bootstrap_platform_admin()
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  platform_count integer;
begin
  if auth.uid() is null then
    raise exception 'Voce precisa estar logado para ativar o admin geral.';
  end if;

  select count(*) into platform_count from public.platform_admins;

  if platform_count > 0 then
    if public.is_platform_admin() then
      return true;
    end if;

    raise exception 'O admin geral da plataforma ja foi configurado.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.church_id is not null
  ) then
    raise exception 'Somente o admin principal da primeira igreja pode ativar o admin geral.';
  end if;

  insert into public.platform_admins (user_id, created_by)
  values (auth.uid(), auth.uid())
  on conflict (user_id) do nothing;

  return true;
end;
$$;

grant execute on function public.bootstrap_platform_admin() to authenticated;

create or replace function public.platform_list_churches()
returns table (
  church_id uuid,
  church_name text,
  city text,
  state text,
  created_at timestamptz,
  admins_count bigint,
  profiles_count bigint,
  cells_count bigint,
  people_count bigint,
  invites_count bigint
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  return query
  select
    church.id as church_id,
    church.name as church_name,
    church.city,
    church.state,
    church.created_at,
    (select count(*) from public.profiles p where p.church_id = church.id and p.role = 'admin') as admins_count,
    (select count(*) from public.profiles p where p.church_id = church.id) as profiles_count,
    (select count(*) from public.cells c where c.church_id = church.id) as cells_count,
    (select count(*) from public.people pe where pe.church_id = church.id) as people_count,
    (select count(*) from public.invites inv where inv.church_id = church.id and inv.status = 'pending') as invites_count
  from public.churches church
  order by church.created_at desc;
end;
$$;

grant execute on function public.platform_list_churches() to authenticated;

create or replace function public.platform_create_church_with_admin_invite(
  church_name text,
  church_city text default null,
  church_state text default null,
  admin_name text default null,
  admin_email text default null
)
returns table (
  church_id uuid,
  invite_id uuid,
  invite_token text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  created_church_id uuid;
  created_invite_id uuid;
  generated_token text;
  creator_profile_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  if nullif(trim(coalesce(church_name, '')), '') is null then
    raise exception 'Informe o nome da igreja.';
  end if;

  if nullif(trim(coalesce(admin_email, '')), '') is null then
    raise exception 'Informe o email do admin da igreja.';
  end if;

  select p.id
  into creator_profile_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  insert into public.churches (name, city, state)
  values (
    trim(church_name),
    nullif(trim(coalesce(church_city, '')), ''),
    nullif(trim(coalesce(church_state, '')), '')
  )
  returning id into created_church_id;

  if to_regclass('public.church_settings') is not null then
    insert into public.church_settings (church_id)
    values (created_church_id)
    on conflict (church_id) do nothing;
  end if;

  generated_token := replace(gen_random_uuid()::text, '-', '') || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);

  insert into public.invites (
    church_id,
    token,
    email,
    name,
    role,
    cell_id,
    person_id,
    created_by,
    status,
    expires_at
  )
  values (
    created_church_id,
    generated_token,
    lower(trim(admin_email)),
    nullif(trim(coalesce(admin_name, '')), ''),
    'admin',
    null,
    null,
    creator_profile_id,
    'pending',
    now() + interval '14 days'
  )
  returning id into created_invite_id;

  return query
  select created_church_id, created_invite_id, generated_token;
end;
$$;

grant execute on function public.platform_create_church_with_admin_invite(text, text, text, text, text) to authenticated;

-- Complemento 2026-06-10: perfil, comunicacao, presenca de supervisor e consolidacao ampliada.

alter table public.cell_reports
  add column if not exists supervisor_visited boolean not null default false,
  add column if not exists supervisor_visit_notes text;

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

alter table public.consolidation_reports
  add column if not exists preacher_name text,
  add column if not exists tithe_count integer not null default 0,
  add column if not exists offering_count integer not null default 0,
  add column if not exists tithe_names text,
  add column if not exists offering_names text;

create or replace function public.update_my_profile(profile_name text)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  update public.profiles
  set name = nullif(trim(coalesce(profile_name, '')), '')
  where id = auth.uid();

  return found;
end;
$$;

grant execute on function public.update_my_profile(text) to authenticated;

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
            target_role::text in ('admin', 'pastor', 'supervisor', 'consolidation', 'communication')
            or (
              target_role::text in ('leader', 'member')
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
          p.role::text = 'pastor'
          and (
            target_role::text in ('supervisor', 'consolidation', 'communication')
            or (
              target_role::text in ('leader', 'member')
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
          p.role::text = 'supervisor'
          and (
            (
              target_role::text = 'supervisor'
              and exists (
                select 1
                from public.cells c
                where c.id = target_cell_id
                  and c.church_id = target_church_id
                  and c.supervisor_id = p.id
              )
            )
            or (
              target_role::text in ('leader', 'member')
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
        or (
          p.role::text = 'leader'
          and target_role::text = 'member'
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

grant execute on function public.can_create_invite(uuid, app_role, uuid) to authenticated;

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
    left join public.people member_person on member_person.person_user_id = p.id
    where p.id = auth.uid()
    and p.church_id = activity_events.church_id
    and (
      (
        p.role::text in ('admin', 'pastor')
        and (
          activity_events.visibility <> 'member'
          or (activity_events.visibility = 'member' and activity_events.cell_id is null and activity_events.person_id is null)
        )
      )
      or (
        p.role::text = 'communication'
        and activity_events.visibility = 'member'
      )
      or (p.role::text = 'consolidation' and p.id = activity_events.actor_user_id)
      or (p.role::text = 'supervisor' and (p.id = c.supervisor_id or p.id = activity_events.actor_user_id))
      or (p.role::text = 'leader' and (p.id = c.leader_id or p.id = pe.leader_user_id or p.id = activity_events.actor_user_id))
      or (
        p.role::text = 'member'
        and activity_events.visibility = 'member'
        and (
          p.id = activity_events.actor_user_id
          or p.id = pe.person_user_id
          or (activity_events.cell_id is null and activity_events.person_id is null)
          or member_person.cell_id = activity_events.cell_id
        )
      )
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
      and (
        p.role::text in ('admin', 'pastor', 'supervisor', 'leader', 'consolidation', 'communication')
        or p.id = activity_events.actor_user_id
      )
  )
);

grant select, insert on public.activity_events to authenticated;

-- Complemento 2026-07-17 (7): avisos com publico selecionavel (mais de um papel ao mesmo tempo).

alter table public.activity_events add column if not exists target_roles text[];

drop policy if exists "activity_events_select_by_target_roles" on public.activity_events;
create policy "activity_events_select_by_target_roles"
on public.activity_events
for select
using (
  activity_events.target_roles is not null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = activity_events.church_id
    and p.role::text = any(activity_events.target_roles)
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role'
      and e.enumlabel = 'communication'
  ) then
    alter type app_role add value 'communication';
  end if;
end $$;

-- Complemento 2026-07-17: area administrativa da plataforma (financeiro, suporte, auditoria).
-- Depende de subscriptions.sql ja ter sido executado (tabela church_subscriptions).

create table if not exists public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_church_id uuid references public.churches(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.platform_audit_log enable row level security;

drop policy if exists "platform_audit_log_platform_admin_only" on public.platform_audit_log;
create policy "platform_audit_log_platform_admin_only"
on public.platform_audit_log
for select
using (public.is_platform_admin());

grant select on public.platform_audit_log to authenticated;

create table if not exists public.platform_church_notes (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  note text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_church_notes enable row level security;

drop policy if exists "platform_church_notes_platform_admin_only" on public.platform_church_notes;
create policy "platform_church_notes_platform_admin_only"
on public.platform_church_notes
for select
using (public.is_platform_admin());

grant select on public.platform_church_notes to authenticated;

create or replace function public.platform_create_church_with_admin_invite(
  church_name text,
  church_city text default null,
  church_state text default null,
  admin_name text default null,
  admin_email text default null
)
returns table (
  church_id uuid,
  invite_id uuid,
  invite_token text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  created_church_id uuid;
  created_invite_id uuid;
  generated_token text;
  creator_profile_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  if nullif(trim(coalesce(church_name, '')), '') is null then
    raise exception 'Informe o nome da igreja.';
  end if;

  if nullif(trim(coalesce(admin_email, '')), '') is null then
    raise exception 'Informe o email do admin da igreja.';
  end if;

  select p.id
  into creator_profile_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  insert into public.churches (name, city, state)
  values (
    trim(church_name),
    nullif(trim(coalesce(church_city, '')), ''),
    nullif(trim(coalesce(church_state, '')), '')
  )
  returning id into created_church_id;

  if to_regclass('public.church_settings') is not null then
    insert into public.church_settings (church_id)
    values (created_church_id)
    on conflict (church_id) do nothing;
  end if;

  generated_token := replace(gen_random_uuid()::text, '-', '') || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);

  insert into public.invites (
    church_id,
    token,
    email,
    name,
    role,
    cell_id,
    person_id,
    created_by,
    status,
    expires_at
  )
  values (
    created_church_id,
    generated_token,
    lower(trim(admin_email)),
    nullif(trim(coalesce(admin_name, '')), ''),
    'admin',
    null,
    null,
    creator_profile_id,
    'pending',
    now() + interval '14 days'
  )
  returning id into created_invite_id;

  insert into public.platform_audit_log (actor_id, action, target_church_id, details)
  values (auth.uid(), 'create_church', created_church_id, jsonb_build_object('church_name', trim(church_name), 'admin_email', lower(trim(admin_email))));

  return query
  select created_church_id, created_invite_id, generated_token;
end;
$$;

grant execute on function public.platform_create_church_with_admin_invite(text, text, text, text, text) to authenticated;

create or replace function public.platform_list_subscriptions()
returns table (
  church_id uuid,
  church_name text,
  tier text,
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  updated_at timestamptz,
  people_count bigint
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  if to_regclass('public.church_subscriptions') is null then
    return;
  end if;

  return query
  select
    church.id as church_id,
    church.name as church_name,
    sub.tier,
    coalesce(sub.status, 'sem_assinatura') as status,
    sub.trial_ends_at,
    sub.current_period_end,
    coalesce(sub.cancel_at_period_end, false) as cancel_at_period_end,
    sub.updated_at,
    (select count(*) from public.people pe where pe.church_id = church.id) as people_count
  from public.churches church
  left join public.church_subscriptions sub on sub.church_id = church.id
  order by
    case coalesce(sub.status, 'sem_assinatura')
      when 'past_due' then 0
      when 'unpaid' then 1
      when 'incomplete' then 2
      when 'trialing' then 3
      when 'active' then 4
      else 5
    end,
    church.created_at desc;
end;
$$;

grant execute on function public.platform_list_subscriptions() to authenticated;

create or replace function public.platform_extend_trial(
  target_church_id uuid,
  extra_days integer default 14
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  if extra_days is null or extra_days <= 0 then
    raise exception 'Informe uma quantidade de dias valida.';
  end if;

  insert into public.church_subscriptions (church_id, status, trial_ends_at)
  values (target_church_id, 'trialing', now() + make_interval(days => extra_days))
  on conflict (church_id) do update
  set
    status = 'trialing',
    trial_ends_at = greatest(coalesce(public.church_subscriptions.trial_ends_at, now()), now()) + make_interval(days => extra_days),
    updated_at = now();

  insert into public.platform_audit_log (actor_id, action, target_church_id, details)
  values (auth.uid(), 'extend_trial', target_church_id, jsonb_build_object('extra_days', extra_days));
end;
$$;

grant execute on function public.platform_extend_trial(uuid, integer) to authenticated;

create or replace function public.platform_add_church_note(
  target_church_id uuid,
  note_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  new_note_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  if nullif(trim(coalesce(note_text, '')), '') is null then
    raise exception 'Escreva uma anotacao antes de salvar.';
  end if;

  insert into public.platform_church_notes (church_id, note, created_by)
  values (target_church_id, trim(note_text), auth.uid())
  returning id into new_note_id;

  insert into public.platform_audit_log (actor_id, action, target_church_id, details)
  values (auth.uid(), 'add_note', target_church_id, jsonb_build_object('note', trim(note_text)));

  return new_note_id;
end;
$$;

grant execute on function public.platform_add_church_note(uuid, text) to authenticated;

create or replace function public.platform_list_church_notes(target_church_id uuid)
returns table (
  id uuid,
  note text,
  created_by_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  return query
  select n.id, n.note, p.name as created_by_name, n.created_at
  from public.platform_church_notes n
  left join public.profiles p on p.id = n.created_by
  where n.church_id = target_church_id
  order by n.created_at desc;
end;
$$;

grant execute on function public.platform_list_church_notes(uuid) to authenticated;

create or replace function public.platform_list_audit_log(limit_count integer default 100)
returns table (
  id uuid,
  actor_name text,
  action text,
  target_church_id uuid,
  target_church_name text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  return query
  select
    log.id,
    p.name as actor_name,
    log.action,
    log.target_church_id,
    church.name as target_church_name,
    log.details,
    log.created_at
  from public.platform_audit_log log
  left join public.profiles p on p.id = log.actor_id
  left join public.churches church on church.id = log.target_church_id
  order by log.created_at desc
  limit greatest(limit_count, 1);
end;
$$;

grant execute on function public.platform_list_audit_log(integer) to authenticated;

-- Complemento 2026-07-17 (2): suporte via "entrar como admin da igreja" (impersonacao).

create or replace function public.platform_list_church_admins(target_church_id uuid)
returns table (
  id uuid,
  name text,
  role text,
  email text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  return query
  select
    p.id,
    p.name,
    p.role::text,
    u.email,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.church_id = target_church_id
    and p.role::text in ('admin', 'pastor')
  order by
    case p.role::text when 'admin' then 0 else 1 end,
    p.created_at asc;
end;
$$;

grant execute on function public.platform_list_church_admins(uuid) to authenticated;

drop function if exists public.platform_list_churches();

create or replace function public.platform_list_churches()
returns table (
  church_id uuid,
  church_name text,
  city text,
  state text,
  created_at timestamptz,
  admins_count bigint,
  profiles_count bigint,
  cells_count bigint,
  people_count bigint,
  invites_count bigint,
  primary_admin_id uuid,
  primary_admin_name text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  return query
  select
    church.id as church_id,
    church.name as church_name,
    church.city,
    church.state,
    church.created_at,
    (select count(*) from public.profiles p where p.church_id = church.id and p.role = 'admin') as admins_count,
    (select count(*) from public.profiles p where p.church_id = church.id) as profiles_count,
    (select count(*) from public.cells c where c.church_id = church.id) as cells_count,
    (select count(*) from public.people pe where pe.church_id = church.id) as people_count,
    (select count(*) from public.invites inv where inv.church_id = church.id and inv.status = 'pending') as invites_count,
    leadership.id as primary_admin_id,
    leadership.name as primary_admin_name
  from public.churches church
  left join lateral (
    select p.id, p.name
    from public.profiles p
    where p.church_id = church.id
      and p.role::text in ('admin', 'pastor')
    order by case p.role::text when 'admin' then 0 else 1 end, p.created_at asc
    limit 1
  ) leadership on true
  order by church.created_at desc;
end;
$$;

grant execute on function public.platform_list_churches() to authenticated;

-- Complemento 2026-07-17 (3): gestao completa da assinatura (vitalicio gratis, revogar acesso).

alter table public.church_subscriptions drop constraint if exists church_subscriptions_status_check;
alter table public.church_subscriptions add constraint church_subscriptions_status_check
  check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'lifetime'));

create or replace function public.platform_grant_lifetime_access(target_church_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  insert into public.church_subscriptions (church_id, status, trial_ends_at, current_period_end, cancel_at_period_end)
  values (target_church_id, 'lifetime', null, null, false)
  on conflict (church_id) do update
  set
    status = 'lifetime',
    trial_ends_at = null,
    current_period_end = null,
    cancel_at_period_end = false,
    updated_at = now();

  insert into public.platform_audit_log (actor_id, action, target_church_id, details)
  values (auth.uid(), 'grant_lifetime', target_church_id, '{}'::jsonb);
end;
$$;

grant execute on function public.platform_grant_lifetime_access(uuid) to authenticated;

create or replace function public.platform_revoke_access(target_church_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao admin geral da plataforma.';
  end if;

  insert into public.church_subscriptions (church_id, status)
  values (target_church_id, 'canceled')
  on conflict (church_id) do update
  set status = 'canceled', updated_at = now();

  insert into public.platform_audit_log (actor_id, action, target_church_id, details)
  values (auth.uid(), 'revoke_access', target_church_id, '{}'::jsonb);
end;
$$;

grant execute on function public.platform_revoke_access(uuid) to authenticated;

-- Complemento 2026-07-17 (4): inteligencia do Lar de Paz (relatorio de visita, status, promocao a celula).

alter table public.peace_houses
  add column if not exists status text not null default 'em_acompanhamento'
    check (status in ('em_acompanhamento', 'pronta_para_celula', 'virou_celula')),
  add column if not exists promoted_cell_id uuid references public.cells(id) on delete set null;

create table if not exists public.peace_visits (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  house_id uuid not null references public.peace_houses(id) on delete cascade,
  visited_at date not null default current_date,
  accepted_jesus boolean,
  wants_cell boolean,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.peace_visits enable row level security;

drop policy if exists "peace_visits_select_by_responsibility" on public.peace_visits;
create policy "peace_visits_select_by_responsibility"
on public.peace_visits
for select
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = peace_visits.church_id
    and p.role in ('admin', 'pastor')
  )
  or exists (
    select 1
    from public.peace_houses h
    join public.cells c on c.id = h.cell_id
    join public.profiles p on p.id = auth.uid()
    where h.id = peace_visits.house_id
    and (
      (p.role = 'supervisor' and c.supervisor_id = p.id)
      or (p.role = 'leader' and c.leader_id = p.id)
    )
  )
);

drop policy if exists "peace_visits_insert_by_leadership" on public.peace_visits;
create policy "peace_visits_insert_by_leadership"
on public.peace_visits
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = peace_visits.church_id
    and p.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

grant select, insert on public.peace_visits to authenticated;

create or replace function public.add_peace_visit(
  target_house_id uuid,
  accepted_jesus boolean,
  wants_cell boolean,
  visit_notes text default null,
  visit_date date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_visit_id uuid;
  target_church_id uuid;
  target_cell_id uuid;
  house_name text;
  house_status text;
begin
  select church_id, cell_id, full_name, status
  into target_church_id, target_cell_id, house_name, house_status
  from public.peace_houses
  where id = target_house_id;

  if target_church_id is null then
    raise exception 'Casa nao encontrada.';
  end if;

  insert into public.peace_visits (church_id, house_id, visited_at, accepted_jesus, wants_cell, notes, created_by)
  values (
    target_church_id,
    target_house_id,
    coalesce(visit_date, current_date),
    accepted_jesus,
    wants_cell,
    nullif(trim(coalesce(visit_notes, '')), ''),
    auth.uid()
  )
  returning id into new_visit_id;

  if wants_cell and house_status <> 'virou_celula' then
    update public.peace_houses
    set status = 'pronta_para_celula', updated_at = now()
    where id = target_house_id;

    insert into public.pastoral_reminders (
      church_id, assigned_to, title, description, reminder_type, due_at, cell_id, created_by
    )
    values (
      target_church_id,
      null,
      'Lar de Paz: ' || house_name || ' quer uma celula',
      'A casa registrou interesse em iniciar uma celula. Avalie e promova quando estiver pronta.',
      'lar_de_paz',
      now() + interval '3 days',
      target_cell_id,
      auth.uid()
    );
  end if;

  return new_visit_id;
end;
$$;

grant execute on function public.add_peace_visit(uuid, boolean, boolean, text, date) to authenticated;

create or replace function public.list_peace_visits(target_house_id uuid)
returns table (
  id uuid,
  visited_at date,
  accepted_jesus boolean,
  wants_cell boolean,
  notes text,
  created_by_name text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select v.id, v.visited_at, v.accepted_jesus, v.wants_cell, v.notes, p.name, v.created_at
  from public.peace_visits v
  left join public.profiles p on p.id = v.created_by
  where v.house_id = target_house_id
  order by v.visited_at desc, v.created_at desc;
$$;

grant execute on function public.list_peace_visits(uuid) to authenticated;

create or replace function public.promote_peace_house_to_cell(
  target_house_id uuid,
  cell_name text,
  leader_id uuid default null,
  supervisor_id uuid default null,
  meeting_day text default null,
  meeting_time text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  house record;
  new_cell_id uuid;
begin
  select * into house from public.peace_houses where id = target_house_id;

  if house.id is null then
    raise exception 'Casa nao encontrada.';
  end if;

  if nullif(trim(coalesce(cell_name, '')), '') is null then
    raise exception 'Informe o nome da celula.';
  end if;

  insert into public.cells (church_id, name, leader_id, supervisor_id, meeting_day, meeting_time, address, neighborhood, active)
  values (
    house.church_id,
    trim(cell_name),
    leader_id,
    supervisor_id,
    nullif(trim(coalesce(meeting_day, '')), ''),
    nullif(trim(coalesce(meeting_time, '')), ''),
    house.address,
    house.neighborhood,
    true
  )
  returning id into new_cell_id;

  update public.peace_houses
  set status = 'virou_celula', promoted_cell_id = new_cell_id, updated_at = now()
  where id = target_house_id;

  return new_cell_id;
end;
$$;

grant execute on function public.promote_peace_house_to_cell(uuid, text, uuid, uuid, text, text) to authenticated;

-- Complemento 2026-07-17 (5): permitir editar e excluir casas/duplas do Lar de Paz (tela unificada).

drop policy if exists "peace_houses_delete_by_responsibility" on public.peace_houses;
create policy "peace_houses_delete_by_responsibility"
on public.peace_houses
for delete
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

grant delete on public.peace_houses to authenticated;

drop policy if exists "peace_pairs_delete_by_responsibility" on public.peace_pairs;
create policy "peace_pairs_delete_by_responsibility"
on public.peace_pairs
for delete
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

grant delete on public.peace_pairs to authenticated;

-- Complemento 2026-07-17 (6): upload de logo real da igreja.

insert into storage.buckets (id, name, public)
values ('church-logos', 'church-logos', true)
on conflict (id) do nothing;

drop policy if exists "church_logos_public_read" on storage.objects;
create policy "church_logos_public_read"
on storage.objects
for select
using (bucket_id = 'church-logos');

drop policy if exists "church_logos_insert_leadership" on storage.objects;
create policy "church_logos_insert_leadership"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'church-logos'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "church_logos_update_leadership" on storage.objects;
create policy "church_logos_update_leadership"
on storage.objects
for update
to authenticated
using (bucket_id = 'church-logos')
with check (
  bucket_id = 'church-logos'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'pastor')
  )
);

-- Complemento 2026-07-17 (8): multiplas funcoes por pessoa (ex: lider + comunicacao).

alter table public.profiles add column if not exists additional_roles app_role[] not null default '{}';

create or replace function public.current_app_has_role(check_role app_role)
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
    and (p.role = check_role or check_role = any(p.additional_roles))
  )
$$;

grant execute on function public.current_app_has_role(app_role) to authenticated;

create or replace function public.current_app_user()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
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
    'additional_roles', coalesce(to_jsonb(p.additional_roles), '[]'::jsonb),
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

drop function if exists public.get_my_profiles();

create or replace function public.get_my_profiles()
returns table (
  id uuid,
  church_id uuid,
  name text,
  role app_role,
  additional_roles app_role[]
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

  if viewer.id is null then
    return;
  end if;

  if viewer.role::text = 'member' then
    return query
    select p.id, p.church_id, p.name, p.role, p.additional_roles
    from public.profiles p
    where p.id = viewer.id;
    return;
  end if;

  return query
  select p.id, p.church_id, p.name, p.role, p.additional_roles
  from public.profiles p
  where p.church_id = viewer.church_id
  order by p.name;
end;
$$;

grant execute on function public.get_my_profiles() to authenticated;

create or replace function public.update_profile_additional_roles(
  target_user_id uuid,
  new_roles app_role[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_church_id uuid;
begin
  select church_id into target_church_id from public.profiles where id = target_user_id;

  if target_church_id is null then
    raise exception 'Usuario nao encontrado.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.church_id = target_church_id
      and p.role in ('admin', 'pastor')
  ) then
    raise exception 'Apenas admin ou pastor podem alterar funcoes adicionais.';
  end if;

  update public.profiles
  set additional_roles = coalesce(new_roles, '{}')
  where id = target_user_id;
end;
$$;

grant execute on function public.update_profile_additional_roles(uuid, app_role[]) to authenticated;

drop policy if exists "consolidation_reports_select_by_role" on public.consolidation_reports;
create policy "consolidation_reports_select_by_role"
on public.consolidation_reports
for select
to authenticated
using (
  church_id = public.current_app_church_id()
  and (public.current_app_role()::text in ('admin', 'pastor') or public.current_app_has_role('consolidation'))
);

drop policy if exists "consolidation_reports_insert_by_role" on public.consolidation_reports;
create policy "consolidation_reports_insert_by_role"
on public.consolidation_reports
for insert
to authenticated
with check (
  church_id = public.current_app_church_id()
  and (public.current_app_role()::text in ('admin', 'pastor') or public.current_app_has_role('consolidation'))
);

drop policy if exists "consolidation_reports_delete_by_role" on public.consolidation_reports;
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

drop policy if exists "consolidation_visitors_select_by_role" on public.consolidation_visitors;
create policy "consolidation_visitors_select_by_role"
on public.consolidation_visitors
for select
to authenticated
using (
  church_id = public.current_app_church_id()
  and (public.current_app_role()::text in ('admin', 'pastor') or public.current_app_has_role('consolidation'))
);

drop policy if exists "consolidation_visitors_insert_by_role" on public.consolidation_visitors;
create policy "consolidation_visitors_insert_by_role"
on public.consolidation_visitors
for insert
to authenticated
with check (
  church_id = public.current_app_church_id()
  and (public.current_app_role()::text in ('admin', 'pastor') or public.current_app_has_role('consolidation'))
);

drop policy if exists "consolidation_visitors_update_by_role" on public.consolidation_visitors;
create policy "consolidation_visitors_update_by_role"
on public.consolidation_visitors
for update
to authenticated
using (
  church_id = public.current_app_church_id()
  and (public.current_app_role()::text in ('admin', 'pastor') or public.current_app_has_role('consolidation'))
)
with check (
  church_id = public.current_app_church_id()
  and (public.current_app_role()::text in ('admin', 'pastor') or public.current_app_has_role('consolidation'))
);

drop policy if exists "consolidation_visitors_delete_by_role" on public.consolidation_visitors;
create policy "consolidation_visitors_delete_by_role"
on public.consolidation_visitors
for delete
to authenticated
using (
  church_id = public.current_app_church_id()
  and (public.current_app_role()::text in ('admin', 'pastor') or public.current_app_has_role('consolidation'))
);
