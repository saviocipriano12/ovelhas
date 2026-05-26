-- Ovelhas - correcao emergencial de RLS
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- Ele remove politicas antigas/recursivas de profiles e recria a base segura
-- para celular/desktop carregarem os mesmos dados reais.

begin;

-- 1) Remove TODAS as policies existentes em profiles. Isso elimina qualquer
-- policy antiga que consulte profiles dentro da propria policy e cause:
-- "infinite recursion detected in policy for relation profiles".
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_record.policyname);
  end loop;
end;
$$;

alter table public.profiles enable row level security;

-- 2) Profile pode ser lido por usuarios autenticados. As outras tabelas continuam
-- controlando o escopo de igreja/celula. Essa policy simples nao chama profiles,
-- entao nao gera recursao.
create policy "profiles_select_authenticated_safe"
on public.profiles
for select
to authenticated
using (auth.uid() is not null);

-- 3) Funcoes de apoio usam security definer e row_security off para consultar
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

-- 4) Recria update de profiles sem recursao.
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_update_admin_or_pastor" on public.profiles;
drop policy if exists "profiles_update_admin_or_pastor_safe" on public.profiles;

create policy "profiles_update_admin_or_pastor_safe"
on public.profiles
for update
to authenticated
using (public.can_admin_church(profiles.church_id))
with check (public.can_admin_church(profiles.church_id));

-- 5) Recria funcoes de convite sem RLS interno.
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

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_app_church_id() to authenticated;
grant execute on function public.can_admin_church(uuid) to authenticated;
grant execute on function public.can_view_person(public.people) to authenticated;
grant execute on function public.current_app_user() to authenticated;
grant execute on function public.can_create_invite(uuid, app_role, uuid) to authenticated;
grant execute on function public.can_view_invite(uuid, uuid, uuid) to anon, authenticated;

commit;
