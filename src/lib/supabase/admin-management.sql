-- Ovelhas - administracao de acessos e cobertura pastoral
-- Rode este arquivo depois de schema.sql, bootstrap.sql e accountability.sql.

drop policy if exists "cells_update_admin_or_pastor" on public.cells;
create policy "cells_update_admin_or_pastor"
on public.cells
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'pastor')
    and p.church_id = cells.church_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'pastor')
    and p.church_id = cells.church_id
  )
);

drop policy if exists "profiles_update_admin_or_pastor" on public.profiles;
create policy "profiles_update_admin_or_pastor"
on public.profiles
for update
using (
  exists (
    select 1
    from public.profiles manager
    where manager.id = auth.uid()
    and manager.role in ('admin', 'pastor')
    and manager.church_id = profiles.church_id
  )
)
with check (
  exists (
    select 1
    from public.profiles manager
    where manager.id = auth.uid()
    and manager.role in ('admin', 'pastor')
    and manager.church_id = profiles.church_id
  )
);

drop policy if exists "profiles_select_supervisor_or_leader_names" on public.profiles;
create policy "profiles_select_supervisor_or_leader_names"
on public.profiles
for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles viewer
    where viewer.id = auth.uid()
    and viewer.church_id = profiles.church_id
    and viewer.role in ('admin', 'pastor', 'supervisor')
  )
);
