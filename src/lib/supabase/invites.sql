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
