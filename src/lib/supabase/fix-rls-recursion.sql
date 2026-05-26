-- Ovelhas - reset de seguranca e funcoes de producao
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- Pode rodar mais de uma vez. Ele remove policies antigas/recursivas,
-- recria funcoes oficiais do app e libera celulas, pessoas e convites
-- com uma fonte unica de verdade no Supabase.

begin;

-- 1) Remove TODAS as policies antigas das tabelas centrais. Isso elimina
-- policies que chamavam profiles por dentro e causavam recursao.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'cells', 'people', 'invites')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.current_app_role() cascade;
drop function if exists public.current_app_church_id() cascade;
drop function if exists public.current_app_user() cascade;
drop function if exists public.can_admin_church(uuid) cascade;
drop function if exists public.can_view_cell(public.cells) cascade;
drop function if exists public.can_manage_cell(public.cells) cascade;
drop function if exists public.can_view_person(public.people) cascade;
drop function if exists public.can_create_invite(uuid, app_role, uuid) cascade;
drop function if exists public.can_view_invite(uuid, uuid) cascade;
drop function if exists public.can_view_invite(uuid, uuid, uuid) cascade;
drop function if exists public.get_my_profiles() cascade;
drop function if exists public.get_my_cells() cascade;
drop function if exists public.get_my_people() cascade;
drop function if exists public.get_my_invites() cascade;
drop function if exists public.create_invite_secure(text, text, text, app_role, uuid, timestamptz) cascade;
drop function if exists public.create_cell_secure(text, uuid, uuid, text, text, text, text) cascade;
drop function if exists public.update_cell_secure(uuid, text, uuid, uuid, text, text, text, text) cascade;
drop function if exists public.delete_cell_secure(uuid) cascade;
drop function if exists public.delete_invite_secure(uuid) cascade;
drop function if exists public.get_invite_by_token(text) cascade;
drop function if exists public.accept_invite(text) cascade;
drop function if exists public.accept_invite_for_user(uuid, text, text) cascade;
drop function if exists public.handle_new_user() cascade;

alter table public.profiles enable row level security;
alter table public.cells enable row level security;
alter table public.people enable row level security;
alter table public.invites enable row level security;

-- 2) Funcoes de apoio usam security definer e row_security off para consultar
-- profiles sem disparar policies de profiles dentro de policies de outras tabelas.
create or replace function public.current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public
set row_security = off
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
set row_security = off
as $$
  select church_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.can_admin_church(target_church_id uuid)
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
      and p.role in ('admin', 'pastor')
  )
$$;

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
        p.role in ('admin', 'pastor')
        or (p.role = 'supervisor' and target.supervisor_id = p.id)
        or (p.role = 'leader' and target.leader_id = p.id)
        or (
          p.role = 'member'
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

create or replace function public.can_manage_cell(target public.cells)
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
        p.role in ('admin', 'pastor')
        or (p.role = 'supervisor' and target.supervisor_id = p.id)
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
      (p.role in ('admin', 'pastor') and p.church_id = target.church_id)
      or (
        p.role = 'supervisor'
        and exists (
          select 1
          from public.cells c
          where c.id = target.cell_id
            and c.church_id = p.church_id
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
              and c.church_id = p.church_id
              and c.leader_id = p.id
          )
        )
      )
      or (p.role = 'member' and target.person_user_id = p.id)
    )
  )
$$;

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

-- 3) Policies simples e seguras. Elas chamam apenas funcoes security definer,
-- evitando recursao de profiles.
create policy "profiles_select_by_church_safe"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or church_id = public.current_app_church_id()
);

create policy "profiles_update_admin_or_pastor_safe"
on public.profiles
for update
to authenticated
using (public.can_admin_church(profiles.church_id))
with check (public.can_admin_church(profiles.church_id));

create policy "cells_select_by_role_safe"
on public.cells
for select
to authenticated
using (public.can_view_cell(cells));

create policy "cells_insert_by_leadership_safe"
on public.cells
for insert
to authenticated
with check (
  church_id = public.current_app_church_id()
  and public.current_app_role() in ('admin', 'pastor', 'supervisor')
);

create policy "cells_update_by_leadership_safe"
on public.cells
for update
to authenticated
using (public.can_manage_cell(cells))
with check (public.can_manage_cell(cells));

create policy "people_select_by_role_safe"
on public.people
for select
to authenticated
using (public.can_view_person(people));

create policy "people_insert_by_leadership_safe"
on public.people
for insert
to authenticated
with check (
  church_id = public.current_app_church_id()
  and public.current_app_role() in ('admin', 'pastor', 'supervisor', 'leader')
);

create policy "people_update_by_role_safe"
on public.people
for update
to authenticated
using (public.can_view_person(people))
with check (public.can_view_person(people));

-- 4) Funcoes de convite sem RLS interno.
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
          p.role = 'admin'
          and (
            target_role in ('admin', 'pastor', 'supervisor')
            or (
              target_role in ('leader', 'member')
              and exists (
                select 1 from public.cells c
                where c.id = target_cell_id
                  and c.church_id = target_church_id
              )
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
                select 1 from public.cells c
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
            select 1 from public.cells c
            where c.id = target_cell_id
              and c.church_id = target_church_id
              and c.supervisor_id = p.id
          )
        )
        or (
          p.role = 'leader'
          and target_role = 'member'
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

create or replace function public.can_view_invite(
  target_church_id uuid,
  target_created_by uuid,
  target_cell_id uuid
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
        or (
          p.role = 'leader'
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

create policy "invites_select_by_role_safe"
on public.invites
for select
to authenticated
using (public.can_view_invite(invites.church_id, invites.created_by, invites.cell_id));

create policy "invites_insert_by_role_safe"
on public.invites
for insert
to authenticated
with check (public.can_create_invite(invites.church_id, invites.role, invites.cell_id));

create policy "invites_update_by_role_safe"
on public.invites
for update
to authenticated
using (public.can_view_invite(invites.church_id, invites.created_by, invites.cell_id))
with check (public.can_view_invite(invites.church_id, invites.created_by, invites.cell_id));

create policy "invites_delete_by_role_safe"
on public.invites
for delete
to authenticated
using (public.can_view_invite(invites.church_id, invites.created_by, invites.cell_id));

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_app_church_id() to authenticated;
grant execute on function public.can_admin_church(uuid) to authenticated;
grant execute on function public.can_view_cell(public.cells) to authenticated;
grant execute on function public.can_manage_cell(public.cells) to authenticated;
grant execute on function public.can_view_person(public.people) to authenticated;
grant execute on function public.current_app_user() to authenticated;
grant execute on function public.can_create_invite(uuid, app_role, uuid) to authenticated;
grant execute on function public.can_view_invite(uuid, uuid, uuid) to anon, authenticated;

-- 6) RPCs centrais para o app. Elas evitam que mobile/desktop dependam de
-- policies complexas em leituras basicas de celulas, pessoas e perfis.
create or replace function public.get_my_profiles()
returns table (
  id uuid,
  church_id uuid,
  name text,
  role app_role
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

  if viewer.role = 'member' then
    return query
    select p.id, p.church_id, p.name, p.role
    from public.profiles p
    where p.id = viewer.id;
    return;
  end if;

  return query
  select p.id, p.church_id, p.name, p.role
  from public.profiles p
  where p.church_id = viewer.church_id
  order by p.name;
end;
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
      viewer.role in ('admin', 'pastor')
      or (viewer.role = 'supervisor' and c.supervisor_id = viewer.id)
      or (viewer.role = 'leader' and c.leader_id = viewer.id)
      or (
        viewer.role = 'member'
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

create or replace function public.get_my_invites()
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
  select i.id, i.church_id, i.token, i.email, i.name, i.role, i.cell_id, i.created_by,
         i.status, i.expires_at, i.accepted_by, i.accepted_at, i.created_at
  from public.invites i
  left join public.cells c on c.id = i.cell_id
  where i.church_id = viewer.church_id
    and (
      viewer.role in ('admin', 'pastor')
      or i.created_by = viewer.id
      or (viewer.role = 'supervisor' and c.supervisor_id = viewer.id)
      or (viewer.role = 'leader' and c.leader_id = viewer.id)
    )
  order by i.created_at desc;
end;
$$;

create or replace function public.create_invite_secure(
  invite_token text,
  invite_email text default null,
  invite_name text default null,
  invite_role app_role default 'member',
  invite_cell_id uuid default null,
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

  target_cell_id := invite_cell_id;

  if invite_role in ('leader', 'member') and target_cell_id is null then
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
    created_by,
    status,
    expires_at
  )
  values (
    viewer.church_id,
    invite_token,
    nullif(trim(coalesce(invite_email, '')), ''),
    nullif(trim(coalesce(invite_name, '')), ''),
    invite_role,
    target_cell_id,
    viewer.id,
    'pending',
    coalesce(invite_expires_at, now() + interval '14 days')
  )
  returning *
  into created_invite;

  return query
  select created_invite.id, created_invite.church_id, created_invite.token, created_invite.email,
         created_invite.name, created_invite.role, created_invite.cell_id, created_invite.created_by,
         created_invite.status, created_invite.expires_at, created_invite.accepted_by,
         created_invite.accepted_at, created_invite.created_at;
end;
$$;

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
set row_security = off
as $$
  select i.id, i.church_id, i.token, i.email, i.name, i.role, i.cell_id, i.created_by,
         i.status, i.expires_at, i.accepted_by, i.accepted_at, i.created_at
  from public.invites i
  where i.token = invite_token
  limit 1
$$;

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

  if target_invite.role = 'leader' and target_invite.cell_id is not null then
    update public.cells
    set leader_id = target_user_id
    where id = target_invite.cell_id
      and church_id = target_invite.church_id;
  end if;

  if target_invite.role = 'supervisor' and target_invite.cell_id is not null then
    update public.cells
    set supervisor_id = target_user_id
    where id = target_invite.cell_id
      and church_id = target_invite.church_id;
  end if;

  if target_invite.role = 'member' then
    select coalesce(c.leader_id, target_invite.created_by)
    into target_leader_id
    from public.cells c
    where c.id = target_invite.cell_id
      and c.church_id = target_invite.church_id
    limit 1;

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
    )
    on conflict do nothing;
  end if;

  update public.invites
  set status = 'accepted',
      accepted_by = target_user_id,
      accepted_at = now()
  where id = target_invite.id;

  return true;
end;
$$;

create or replace function public.accept_invite(invite_token text)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select email
  into user_email
  from auth.users
  where id = auth.uid()
  limit 1;

  return public.accept_invite_for_user(auth.uid(), user_email, invite_token);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Novo usuario'),
    'member'
  )
  on conflict (id) do update
  set name = coalesce(public.profiles.name, excluded.name);

  if new.raw_user_meta_data ? 'invite_token' then
    perform public.accept_invite_for_user(new.id, new.email, new.raw_user_meta_data->>'invite_token');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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
      viewer.role in ('admin', 'pastor')
      or (viewer.role = 'supervisor' and c.supervisor_id = viewer.id)
      or (
        viewer.role = 'leader'
        and (
          pe.leader_user_id = viewer.id
          or pe.created_by_user_id = viewer.id
          or c.leader_id = viewer.id
        )
      )
      or (viewer.role = 'member' and pe.person_user_id = viewer.id)
    )
  order by pe.created_at desc;
end;
$$;

create or replace function public.update_cell_secure(
  target_cell_id uuid,
  cell_name text,
  cell_leader_id uuid default null,
  cell_supervisor_id uuid default null,
  cell_meeting_day text default null,
  cell_meeting_time text default null,
  cell_address text default null,
  cell_neighborhood text default null
)
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
security definer
set search_path = public
set row_security = off
as $$
declare
  viewer public.profiles%rowtype;
  target_cell public.cells%rowtype;
  next_supervisor_id uuid;
begin
  select *
  into viewer
  from public.profiles
  where profiles.id = auth.uid()
  limit 1;

  select *
  into target_cell
  from public.cells
  where cells.id = target_cell_id
  limit 1;

  if viewer.id is null or viewer.church_id is null then
    raise exception 'Usuario sem igreja vinculada.';
  end if;

  if target_cell.id is null or target_cell.church_id <> viewer.church_id then
    raise exception 'Celula nao encontrada.';
  end if;

  if viewer.role not in ('admin', 'pastor', 'supervisor') then
    raise exception 'Seu acesso nao permite editar celulas.';
  end if;

  if viewer.role = 'supervisor' and target_cell.supervisor_id <> viewer.id then
    raise exception 'Supervisor so pode editar celulas sob sua supervisao.';
  end if;

  if nullif(trim(cell_name), '') is null then
    raise exception 'Informe o nome da celula.';
  end if;

  next_supervisor_id := cell_supervisor_id;
  if viewer.role = 'supervisor' then
    next_supervisor_id := viewer.id;
  end if;

  update public.cells
  set name = trim(cell_name),
      leader_id = cell_leader_id,
      supervisor_id = next_supervisor_id,
      meeting_day = nullif(trim(coalesce(cell_meeting_day, '')), ''),
      meeting_time = nullif(trim(coalesce(cell_meeting_time, '')), ''),
      address = nullif(trim(coalesce(cell_address, '')), ''),
      neighborhood = nullif(trim(coalesce(cell_neighborhood, '')), '')
  where cells.id = target_cell_id
  returning *
  into target_cell;

  return query
  select target_cell.id, target_cell.church_id, target_cell.name, target_cell.leader_id,
         target_cell.supervisor_id, target_cell.meeting_day, target_cell.meeting_time,
         target_cell.address, target_cell.neighborhood, target_cell.active;
end;
$$;

create or replace function public.delete_cell_secure(target_cell_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  viewer public.profiles%rowtype;
  target_cell public.cells%rowtype;
begin
  select *
  into viewer
  from public.profiles
  where profiles.id = auth.uid()
  limit 1;

  select *
  into target_cell
  from public.cells
  where cells.id = target_cell_id
  limit 1;

  if viewer.id is null or viewer.church_id is null then
    raise exception 'Usuario sem igreja vinculada.';
  end if;

  if target_cell.id is null or target_cell.church_id <> viewer.church_id then
    raise exception 'Celula nao encontrada.';
  end if;

  if viewer.role not in ('admin', 'pastor', 'supervisor') then
    raise exception 'Seu acesso nao permite apagar celulas.';
  end if;

  if viewer.role = 'supervisor' and target_cell.supervisor_id <> viewer.id then
    raise exception 'Supervisor so pode apagar celulas sob sua supervisao.';
  end if;

  update public.cells
  set active = false
  where id = target_cell_id;

  return true;
end;
$$;

create or replace function public.delete_invite_secure(target_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  viewer public.profiles%rowtype;
  target_invite public.invites%rowtype;
  target_cell public.cells%rowtype;
begin
  select *
  into viewer
  from public.profiles
  where profiles.id = auth.uid()
  limit 1;

  select *
  into target_invite
  from public.invites
  where invites.id = target_invite_id
  limit 1;

  if viewer.id is null or viewer.church_id is null then
    raise exception 'Usuario sem igreja vinculada.';
  end if;

  if target_invite.id is null or target_invite.church_id <> viewer.church_id then
    raise exception 'Convite nao encontrado.';
  end if;

  if target_invite.cell_id is not null then
    select *
    into target_cell
    from public.cells
    where cells.id = target_invite.cell_id
    limit 1;
  end if;

  if not (
    viewer.role in ('admin', 'pastor')
    or target_invite.created_by = viewer.id
    or (viewer.role = 'supervisor' and target_cell.supervisor_id = viewer.id)
    or (viewer.role = 'leader' and target_cell.leader_id = viewer.id)
  ) then
    raise exception 'Seu acesso nao permite apagar este convite.';
  end if;

  delete from public.invites
  where id = target_invite_id;

  return true;
end;
$$;

create or replace function public.create_cell_secure(
  cell_name text,
  cell_leader_id uuid default null,
  cell_supervisor_id uuid default null,
  cell_meeting_day text default null,
  cell_meeting_time text default null,
  cell_address text default null,
  cell_neighborhood text default null
)
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
security definer
set search_path = public
set row_security = off
as $$
declare
  viewer public.profiles%rowtype;
  next_supervisor_id uuid;
  created_cell public.cells%rowtype;
begin
  select *
  into viewer
  from public.profiles
  where profiles.id = auth.uid()
  limit 1;

  if viewer.id is null or viewer.church_id is null then
    raise exception 'Usuario sem igreja vinculada.';
  end if;

  if viewer.role not in ('admin', 'pastor', 'supervisor') then
    raise exception 'Seu acesso nao permite criar celulas.';
  end if;

  next_supervisor_id := cell_supervisor_id;

  if viewer.role = 'supervisor' then
    next_supervisor_id := viewer.id;
  end if;

  if nullif(trim(cell_name), '') is null then
    raise exception 'Informe o nome da celula.';
  end if;

  insert into public.cells (
    church_id,
    name,
    leader_id,
    supervisor_id,
    meeting_day,
    meeting_time,
    address,
    neighborhood,
    active
  )
  values (
    viewer.church_id,
    trim(cell_name),
    cell_leader_id,
    next_supervisor_id,
    nullif(trim(coalesce(cell_meeting_day, '')), ''),
    nullif(trim(coalesce(cell_meeting_time, '')), ''),
    nullif(trim(coalesce(cell_address, '')), ''),
    nullif(trim(coalesce(cell_neighborhood, '')), ''),
    true
  )
  returning *
  into created_cell;

  return query
  select created_cell.id, created_cell.church_id, created_cell.name, created_cell.leader_id,
         created_cell.supervisor_id, created_cell.meeting_day, created_cell.meeting_time,
         created_cell.address, created_cell.neighborhood, created_cell.active;
end;
$$;

grant execute on function public.get_my_profiles() to authenticated;
grant execute on function public.get_my_cells() to authenticated;
grant execute on function public.get_my_people() to authenticated;
grant execute on function public.get_my_invites() to authenticated;
grant execute on function public.create_invite_secure(text, text, text, app_role, uuid, timestamptz) to authenticated;
grant execute on function public.get_invite_by_token(text) to anon, authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.accept_invite_for_user(uuid, text, text) to authenticated;
grant execute on function public.create_cell_secure(text, uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.update_cell_secure(uuid, text, uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_cell_secure(uuid) to authenticated;
grant execute on function public.delete_invite_secure(uuid) to authenticated;

commit;
