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
