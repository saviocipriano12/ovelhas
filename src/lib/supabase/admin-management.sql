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
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

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
