-- Ovelhas - atualizacao de producao
-- Rode este arquivo no Supabase SQL Editor depois do deploy.
-- Ele presume que o schema principal do Ovelhas ja existe.

alter table public.consolidation_reports
  add column if not exists ministry_counts jsonb not null default '{}'::jsonb,
  add column if not exists kids_count integer not null default 0;

alter table public.consolidation_visitors
  add column if not exists age integer;

drop policy if exists "people_delete_by_responsibility" on public.people;
create policy "people_delete_by_responsibility"
on public.people
for delete
using (
  public.can_view_person(people)
  and exists (
    select 1
    from public.profiles viewer
    where viewer.id = auth.uid()
    and viewer.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "discipleship_tracks_delete_by_admin_or_pastor" on public.discipleship_tracks;
create policy "discipleship_tracks_delete_by_admin_or_pastor"
on public.discipleship_tracks
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = discipleship_tracks.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "discipleship_videos_delete_by_admin_or_pastor" on public.discipleship_videos;
create policy "discipleship_videos_delete_by_admin_or_pastor"
on public.discipleship_videos
for delete
using (
  exists (
    select 1
    from public.discipleship_tracks t
    join public.profiles p on p.id = auth.uid()
    where t.id = discipleship_videos.track_id
    and p.church_id = t.church_id
    and p.role in ('admin', 'pastor')
  )
);
