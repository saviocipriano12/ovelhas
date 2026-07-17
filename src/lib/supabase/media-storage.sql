-- Ovelhas - storage real para foto de perfil e midia de avisos
-- Rode depois de schema.sql e admin-management.sql.
-- Sem isso, fotos e midias de avisos ficam em base64 dentro das tabelas, o que nao escala.

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('notice-media', 'notice-media', true)
on conflict (id) do nothing;

drop policy if exists "profile_photos_public_read" on storage.objects;
create policy "profile_photos_public_read"
on storage.objects
for select
using (bucket_id = 'profile-photos');

drop policy if exists "profile_photos_insert_own" on storage.objects;
create policy "profile_photos_insert_own"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'profile-photos');

drop policy if exists "profile_photos_update_own" on storage.objects;
create policy "profile_photos_update_own"
on storage.objects
for update
to authenticated
using (bucket_id = 'profile-photos')
with check (bucket_id = 'profile-photos');

drop policy if exists "notice_media_public_read" on storage.objects;
create policy "notice_media_public_read"
on storage.objects
for select
using (bucket_id = 'notice-media');

drop policy if exists "notice_media_insert_leadership" on storage.objects;
create policy "notice_media_insert_leadership"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'notice-media'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'pastor', 'supervisor', 'leader', 'communication')
  )
);
