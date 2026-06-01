-- Ovelhas - trilhas, videos, liberacao e progresso de discipulado
-- Rode depois de schema.sql, admin-management.sql e attendance.sql.

drop policy if exists "discipleship_tracks_select_by_church" on public.discipleship_tracks;
create policy "discipleship_tracks_select_by_church"
on public.discipleship_tracks
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = discipleship_tracks.church_id
  )
);

drop policy if exists "discipleship_tracks_insert_by_admin_or_pastor" on public.discipleship_tracks;
create policy "discipleship_tracks_insert_by_admin_or_pastor"
on public.discipleship_tracks
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = discipleship_tracks.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "discipleship_tracks_update_by_admin_or_pastor" on public.discipleship_tracks;
create policy "discipleship_tracks_update_by_admin_or_pastor"
on public.discipleship_tracks
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = discipleship_tracks.church_id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = discipleship_tracks.church_id
    and p.role in ('admin', 'pastor')
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

drop policy if exists "discipleship_videos_select_by_track_church" on public.discipleship_videos;
create policy "discipleship_videos_select_by_track_church"
on public.discipleship_videos
for select
using (
  exists (
    select 1
    from public.discipleship_tracks t
    join public.profiles p on p.id = auth.uid()
    where t.id = discipleship_videos.track_id
    and p.church_id = t.church_id
  )
);

drop policy if exists "discipleship_videos_insert_by_admin_or_pastor" on public.discipleship_videos;
create policy "discipleship_videos_insert_by_admin_or_pastor"
on public.discipleship_videos
for insert
with check (
  exists (
    select 1
    from public.discipleship_tracks t
    join public.profiles p on p.id = auth.uid()
    where t.id = discipleship_videos.track_id
    and p.church_id = t.church_id
    and p.role in ('admin', 'pastor')
  )
);

drop policy if exists "discipleship_videos_update_by_admin_or_pastor" on public.discipleship_videos;
create policy "discipleship_videos_update_by_admin_or_pastor"
on public.discipleship_videos
for update
using (
  exists (
    select 1
    from public.discipleship_tracks t
    join public.profiles p on p.id = auth.uid()
    where t.id = discipleship_videos.track_id
    and p.church_id = t.church_id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  exists (
    select 1
    from public.discipleship_tracks t
    join public.profiles p on p.id = auth.uid()
    where t.id = discipleship_videos.track_id
    and p.church_id = t.church_id
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

drop policy if exists "person_track_access_select_by_responsibility" on public.person_track_access;
create policy "person_track_access_select_by_responsibility"
on public.person_track_access
for select
using (
  exists (
    select 1
    from public.people person
    where person.id = person_track_access.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "person_track_access_insert_by_leadership" on public.person_track_access;
create policy "person_track_access_insert_by_leadership"
on public.person_track_access
for insert
with check (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = person_track_access.person_id
    and (
      (p.role in ('admin', 'pastor') and p.church_id = person.church_id)
      or (
        p.role = 'supervisor'
        and exists (
          select 1
          from public.cells c
          where c.id = person.cell_id
          and c.supervisor_id = p.id
        )
      )
      or (
        p.role = 'leader'
        and (
          person.leader_user_id = p.id
          or exists (
            select 1
            from public.cells c
            where c.id = person.cell_id
            and c.leader_id = p.id
          )
        )
      )
    )
  )
);

drop policy if exists "video_progress_select_by_responsibility" on public.video_progress;
create policy "video_progress_select_by_responsibility"
on public.video_progress
for select
using (
  exists (
    select 1
    from public.people person
    where person.id = video_progress.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "video_progress_upsert_by_member_or_leader" on public.video_progress;
create policy "video_progress_upsert_by_member_or_leader"
on public.video_progress
for insert
with check (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = video_progress.person_id
    and (
      person.person_user_id = p.id
      or (p.role in ('admin', 'pastor') and p.church_id = person.church_id)
      or (
        p.role = 'leader'
        and (
          person.leader_user_id = p.id
          or exists (
            select 1
            from public.cells c
            where c.id = person.cell_id
            and c.leader_id = p.id
          )
        )
      )
    )
  )
);

drop policy if exists "video_progress_update_by_member_or_leader" on public.video_progress;
create policy "video_progress_update_by_member_or_leader"
on public.video_progress
for update
using (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = video_progress.person_id
    and (
      person.person_user_id = p.id
      or (p.role in ('admin', 'pastor') and p.church_id = person.church_id)
      or (
        p.role = 'leader'
        and (
          person.leader_user_id = p.id
          or exists (
            select 1
            from public.cells c
            where c.id = person.cell_id
            and c.leader_id = p.id
          )
        )
      )
    )
  )
)
with check (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = video_progress.person_id
    and (
      person.person_user_id = p.id
      or (p.role in ('admin', 'pastor') and p.church_id = person.church_id)
      or (
        p.role = 'leader'
        and (
          person.leader_user_id = p.id
          or exists (
            select 1
            from public.cells c
            where c.id = person.cell_id
            and c.leader_id = p.id
          )
        )
      )
    )
  )
);

create table if not exists public.video_reflections (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  video_id uuid not null references public.discipleship_videos(id) on delete cascade,
  question text not null default 'Reflexao',
  answer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, video_id, question)
);

alter table public.video_reflections enable row level security;

drop policy if exists "video_reflections_select_by_responsibility" on public.video_reflections;
create policy "video_reflections_select_by_responsibility"
on public.video_reflections
for select
using (
  exists (
    select 1
    from public.people person
    where person.id = video_reflections.person_id
    and public.can_view_person(person)
  )
);

drop policy if exists "video_reflections_upsert_by_member_or_leader" on public.video_reflections;
create policy "video_reflections_upsert_by_member_or_leader"
on public.video_reflections
for insert
with check (
  exists (
    select 1
    from public.people person
    join public.profiles p on p.id = auth.uid()
    where person.id = video_reflections.person_id
    and (
      person.person_user_id = p.id
      or (p.role in ('admin', 'pastor') and p.church_id = person.church_id)
      or (
        p.role = 'leader'
        and (
          person.leader_user_id = p.id
          or exists (
            select 1
            from public.cells c
            where c.id = person.cell_id
            and c.leader_id = p.id
          )
        )
      )
    )
  )
);

drop policy if exists "video_reflections_update_by_member_or_leader" on public.video_reflections;
create policy "video_reflections_update_by_member_or_leader"
on public.video_reflections
for update
using (
  exists (
    select 1
    from public.people person
    where person.id = video_reflections.person_id
    and public.can_view_person(person)
  )
)
with check (
  exists (
    select 1
    from public.people person
    where person.id = video_reflections.person_id
    and public.can_view_person(person)
  )
);
