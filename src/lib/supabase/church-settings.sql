-- Ovelhas - configuracoes avancadas da igreja
-- Rode depois de schema.sql e admin-management.sql.

create table if not exists public.church_settings (
  church_id uuid primary key references public.churches(id) on delete cascade,
  logo_url text,
  primary_color text not null default '#064e3b',
  welcome_message text,
  absence_message text,
  discipleship_message text,
  privacy_contact text,
  terms_text text,
  updated_at timestamptz not null default now()
);

alter table public.church_settings enable row level security;

drop policy if exists "church_settings_select_by_church" on public.church_settings;
create policy "church_settings_select_by_church"
on public.church_settings
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_settings.church_id
  )
);

drop policy if exists "church_settings_upsert_by_admin_or_pastor" on public.church_settings;
drop policy if exists "church_settings_upsert_by_admin" on public.church_settings;
create policy "church_settings_upsert_by_admin_or_pastor"
on public.church_settings
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_settings.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "church_settings_update_by_admin_or_pastor" on public.church_settings;
drop policy if exists "church_settings_update_by_admin" on public.church_settings;
create policy "church_settings_update_by_admin_or_pastor"
on public.church_settings
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_settings.church_id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = church_settings.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "churches_select_same_church" on public.churches;
create policy "churches_select_same_church"
on public.churches
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = churches.id
  )
);

drop policy if exists "churches_update_admin_or_pastor" on public.churches;
drop policy if exists "churches_update_admin" on public.churches;
create policy "churches_update_admin_or_pastor"
on public.churches
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = churches.id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = churches.id
    and p.role in ('admin', 'pastor')
  )
);
