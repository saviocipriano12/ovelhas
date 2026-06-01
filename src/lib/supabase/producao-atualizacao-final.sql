-- Ovelhas - atualizacao de producao
-- Rode este arquivo no Supabase SQL Editor depois do deploy.
-- Ele presume que o schema principal do Ovelhas ja existe.

alter table public.consolidation_reports
  add column if not exists ministry_counts jsonb not null default '{}'::jsonb,
  add column if not exists kids_count integer not null default 0;

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
