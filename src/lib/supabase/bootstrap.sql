-- Ovelhas - liberacao temporaria de primeira configuracao
-- Rode no SQL Editor para permitir que um usuario logado crie a primeira igreja.

create policy "churches_insert_authenticated"
on public.churches
for insert
with check (auth.uid() is not null);

create policy "churches_select_authenticated"
on public.churches
for select
using (auth.uid() is not null);

create policy "profiles_update_self_bootstrap"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "cells_insert_admin_or_pastor"
on public.cells
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'pastor')
    and p.church_id = cells.church_id
  )
);
