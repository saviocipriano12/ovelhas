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
