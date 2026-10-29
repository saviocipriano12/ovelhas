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
        (
          (p.role in ('admin', 'pastor') or 'admin' = any(p.additional_roles) or 'pastor' = any(p.additional_roles))
          and p.church_id = target.church_id
        )
        or (
          (p.role = 'supervisor' or 'supervisor' = any(p.additional_roles))
          and exists (
            select 1
            from public.cells c
            where c.id = target.cell_id
              and c.church_id = p.church_id
              and c.supervisor_id = p.id
          )
        )
        or (
          (p.role = 'leader' or 'leader' = any(p.additional_roles))
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
        or (
          (
            p.role in ('consolidation', 'communication')
            or 'consolidation' = any(p.additional_roles)
            or 'communication' = any(p.additional_roles)
          )
          and p.church_id = target.church_id
          and target.created_by_user_id = p.id
        )
        or (
          (p.role = 'member' or 'member' = any(p.additional_roles))
          and target.person_user_id = p.id
        )
      )
  )
$$;

revoke all on function public.can_view_person(public.people) from public, anon;
grant execute on function public.can_view_person(public.people) to authenticated;

drop function if exists public.get_my_cells();

create function public.get_my_cells()
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
  select * into viewer
  from public.profiles
  where profiles.id = auth.uid()
  limit 1;

  if viewer.id is null or viewer.church_id is null then
    return;
  end if;

  return query
  select c.id, c.church_id, c.name, c.leader_id, c.supervisor_id,
         c.meeting_day, c.meeting_time, c.address, c.neighborhood, c.active
  from public.cells c
  where c.church_id = viewer.church_id
    and c.active is true
    and (
      public.current_app_has_role('admin')
      or public.current_app_has_role('pastor')
      or public.current_app_has_role('consolidation')
      or public.current_app_has_role('communication')
      or (public.current_app_has_role('supervisor') and c.supervisor_id = viewer.id)
      or (public.current_app_has_role('leader') and c.leader_id = viewer.id)
      or (
        public.current_app_has_role('member')
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

revoke all on function public.get_my_cells() from public, anon;
grant execute on function public.get_my_cells() to authenticated;

drop function if exists public.get_my_people();

create function public.get_my_people()
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
  photo_url text,
  family_phone text,
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
  select * into viewer
  from public.profiles
  where profiles.id = auth.uid()
  limit 1;

  if viewer.id is null or viewer.church_id is null then
    return;
  end if;

  return query
  select pe.id, pe.church_id, pe.cell_id, pe.person_user_id, pe.created_by_user_id,
         pe.leader_user_id, pe.name, pe.phone, pe.email, pe.birth_date, pe.address,
         pe.photo_url, pe.family_phone, pe.neighborhood, pe.status, pe.journey_stage,
         pe.first_visit_date, pe.notes
  from public.people pe
  left join public.cells c on c.id = pe.cell_id
  where pe.church_id = viewer.church_id
    and (
      public.current_app_has_role('admin')
      or public.current_app_has_role('pastor')
      or (public.current_app_has_role('supervisor') and c.supervisor_id = viewer.id)
      or (
        public.current_app_has_role('leader')
        and (
          pe.leader_user_id = viewer.id
          or pe.created_by_user_id = viewer.id
          or c.leader_id = viewer.id
        )
      )
      or (
        (public.current_app_has_role('consolidation') or public.current_app_has_role('communication'))
        and pe.created_by_user_id = viewer.id
      )
      or (public.current_app_has_role('member') and pe.person_user_id = viewer.id)
    )
  order by pe.created_at desc;
end;
$$;

revoke all on function public.get_my_people() from public, anon;
grant execute on function public.get_my_people() to authenticated;
