create or replace function public.current_app_can_view_cell(target_cell_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = target_cell_id
      and c.church_id = p.church_id
      and (
        public.current_app_has_role('admin')
        or public.current_app_has_role('pastor')
        or public.current_app_has_role('consolidation')
        or public.current_app_has_role('communication')
        or (public.current_app_has_role('supervisor') and c.supervisor_id = p.id)
        or (public.current_app_has_role('leader') and c.leader_id = p.id)
        or (
          public.current_app_has_role('member')
          and exists (
            select 1
            from public.people pe
            where pe.person_user_id = p.id
              and pe.cell_id = c.id
          )
        )
      )
  )
$$;

create or replace function public.current_app_can_operate_cell(target_cell_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.cells c
    join public.profiles p on p.id = auth.uid()
    where c.id = target_cell_id
      and c.church_id = p.church_id
      and (
        public.current_app_has_role('admin')
        or public.current_app_has_role('pastor')
        or (public.current_app_has_role('supervisor') and c.supervisor_id = p.id)
        or (public.current_app_has_role('leader') and c.leader_id = p.id)
      )
  )
$$;

create or replace function public.current_app_can_operate_church(target_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select target_church_id = public.current_app_church_id()
    and (
      public.current_app_has_role('admin')
      or public.current_app_has_role('pastor')
      or public.current_app_has_role('supervisor')
      or public.current_app_has_role('leader')
    )
$$;

create or replace function public.current_app_can_manage_person(target_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.people pe
    where pe.id = target_person_id
      and public.can_view_person(pe)
      and (
        public.current_app_has_role('admin')
        or public.current_app_has_role('pastor')
        or public.current_app_has_role('supervisor')
        or public.current_app_has_role('leader')
      )
  )
$$;

revoke all on function public.current_app_can_view_cell(uuid) from public, anon;
revoke all on function public.current_app_can_operate_cell(uuid) from public, anon;
revoke all on function public.current_app_can_operate_church(uuid) from public, anon;
revoke all on function public.current_app_can_manage_person(uuid) from public, anon;
grant execute on function public.current_app_can_view_cell(uuid) to authenticated;
grant execute on function public.current_app_can_operate_cell(uuid) to authenticated;
grant execute on function public.current_app_can_operate_church(uuid) to authenticated;
grant execute on function public.current_app_can_manage_person(uuid) to authenticated;

create or replace function public.update_profile_additional_roles(
  target_user_id uuid,
  new_roles public.app_role[]
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  target_church_id uuid;
  target_primary_role public.app_role;
  normalized_roles public.app_role[];
begin
  select p.church_id, p.role
  into target_church_id, target_primary_role
  from public.profiles p
  where p.id = target_user_id;

  if target_church_id is null then
    raise exception 'Usuario nao encontrado.';
  end if;

  if target_church_id <> public.current_app_church_id()
    or not (public.current_app_has_role('admin') or public.current_app_has_role('pastor')) then
    raise exception 'Apenas admin ou pastor da mesma igreja podem alterar funcoes adicionais.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(new_roles, '{}'::public.app_role[])) as requested_role
    where requested_role not in ('leader', 'supervisor', 'consolidation', 'communication')
  ) then
    raise exception 'Funcao adicional nao permitida.';
  end if;

  select coalesce(array_agg(distinct requested_role), '{}'::public.app_role[])
  into normalized_roles
  from unnest(coalesce(new_roles, '{}'::public.app_role[])) as requested_role
  where requested_role <> target_primary_role;

  update public.profiles
  set additional_roles = normalized_roles
  where id = target_user_id;
end;
$$;

revoke all on function public.update_profile_additional_roles(uuid, public.app_role[]) from public, anon;
grant execute on function public.update_profile_additional_roles(uuid, public.app_role[]) to authenticated;

drop policy if exists "cells_select_effective_roles" on public.cells;
create policy "cells_select_effective_roles"
on public.cells for select to authenticated
using (public.current_app_can_view_cell(id));

drop policy if exists "cells_insert_effective_roles" on public.cells;
create policy "cells_insert_effective_roles"
on public.cells for insert to authenticated
with check (
  church_id = public.current_app_church_id()
  and (
    public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or (public.current_app_has_role('supervisor') and supervisor_id = auth.uid())
  )
);

drop policy if exists "cells_update_effective_roles" on public.cells;
create policy "cells_update_effective_roles"
on public.cells for update to authenticated
using (
  church_id = public.current_app_church_id()
  and (
    public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or (public.current_app_has_role('supervisor') and supervisor_id = auth.uid())
  )
)
with check (
  church_id = public.current_app_church_id()
  and (
    public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or (public.current_app_has_role('supervisor') and supervisor_id = auth.uid())
  )
);

drop policy if exists "people_insert_effective_roles" on public.people;
create policy "people_insert_effective_roles"
on public.people for insert to authenticated
with check (
  church_id = public.current_app_church_id()
  and (
    public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or public.current_app_can_operate_cell(cell_id)
  )
);

drop policy if exists "people_update_effective_roles" on public.people;
create policy "people_update_effective_roles"
on public.people for update to authenticated
using (
  public.current_app_can_manage_person(id)
  or person_user_id = auth.uid()
)
with check (
  public.current_app_can_manage_person(id)
  or person_user_id = auth.uid()
);

drop policy if exists "cell_meetings_select_effective_roles" on public.cell_meetings;
create policy "cell_meetings_select_effective_roles"
on public.cell_meetings for select to authenticated
using (public.current_app_can_operate_cell(cell_id));

drop policy if exists "cell_meetings_insert_effective_roles" on public.cell_meetings;
create policy "cell_meetings_insert_effective_roles"
on public.cell_meetings for insert to authenticated
with check (public.current_app_can_operate_cell(cell_id));

drop policy if exists "cell_attendance_select_effective_roles" on public.cell_attendance;
create policy "cell_attendance_select_effective_roles"
on public.cell_attendance for select to authenticated
using (
  exists (
    select 1 from public.cell_meetings meeting
    where meeting.id = cell_attendance.meeting_id
      and public.current_app_can_operate_cell(meeting.cell_id)
  )
);

drop policy if exists "cell_attendance_insert_effective_roles" on public.cell_attendance;
create policy "cell_attendance_insert_effective_roles"
on public.cell_attendance for insert to authenticated
with check (
  exists (
    select 1 from public.cell_meetings meeting
    where meeting.id = cell_attendance.meeting_id
      and public.current_app_can_operate_cell(meeting.cell_id)
  )
);

drop policy if exists "cell_reports_select_effective_roles" on public.cell_reports;
create policy "cell_reports_select_effective_roles"
on public.cell_reports for select to authenticated
using (public.current_app_can_operate_cell(cell_id));

drop policy if exists "cell_reports_insert_effective_roles" on public.cell_reports;
create policy "cell_reports_insert_effective_roles"
on public.cell_reports for insert to authenticated
with check (public.current_app_can_operate_cell(cell_id));

drop policy if exists "supervisor_visits_select_effective_roles" on public.supervisor_visits;
create policy "supervisor_visits_select_effective_roles"
on public.supervisor_visits for select to authenticated
using (public.current_app_can_operate_cell(cell_id));

drop policy if exists "supervisor_visits_insert_effective_roles" on public.supervisor_visits;
create policy "supervisor_visits_insert_effective_roles"
on public.supervisor_visits for insert to authenticated
with check (
  public.current_app_can_operate_cell(cell_id)
  and (
    public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or (public.current_app_has_role('supervisor') and supervisor_id = auth.uid())
  )
);

drop policy if exists "church_services_select_effective_roles" on public.church_services;
create policy "church_services_select_effective_roles"
on public.church_services for select to authenticated
using (public.current_app_can_operate_church(church_id));

drop policy if exists "church_services_insert_effective_roles" on public.church_services;
create policy "church_services_insert_effective_roles"
on public.church_services for insert to authenticated
with check (public.current_app_can_operate_church(church_id));

drop policy if exists "service_attendance_select_effective_roles" on public.service_attendance;
create policy "service_attendance_select_effective_roles"
on public.service_attendance for select to authenticated
using (
  exists (
    select 1 from public.people pe
    where pe.id = service_attendance.person_id
      and public.can_view_person(pe)
  )
);

drop policy if exists "service_attendance_insert_effective_roles" on public.service_attendance;
create policy "service_attendance_insert_effective_roles"
on public.service_attendance for insert to authenticated
with check (
  public.current_app_can_manage_person(person_id)
  and exists (
    select 1
    from public.church_services service
    where service.id = service_attendance.service_id
      and public.current_app_can_operate_church(service.church_id)
  )
);

drop policy if exists "follow_ups_select_effective_roles" on public.follow_ups;
create policy "follow_ups_select_effective_roles"
on public.follow_ups for select to authenticated
using (
  exists (
    select 1 from public.people pe
    where pe.id = follow_ups.person_id
      and public.can_view_person(pe)
  )
);

drop policy if exists "follow_ups_insert_effective_roles" on public.follow_ups;
create policy "follow_ups_insert_effective_roles"
on public.follow_ups for insert to authenticated
with check (
  church_id = public.current_app_church_id()
  and public.current_app_can_manage_person(person_id)
);

drop policy if exists "follow_ups_update_effective_roles" on public.follow_ups;
create policy "follow_ups_update_effective_roles"
on public.follow_ups for update to authenticated
using (
  church_id = public.current_app_church_id()
  and (
    assigned_to = auth.uid()
    or public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or public.current_app_has_role('supervisor')
  )
)
with check (
  church_id = public.current_app_church_id()
  and (
    assigned_to = auth.uid()
    or public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or public.current_app_has_role('supervisor')
  )
);

drop policy if exists "cell_rsvps_select_effective_roles" on public.cell_rsvps;
create policy "cell_rsvps_select_effective_roles"
on public.cell_rsvps for select to authenticated
using (
  public.current_app_can_operate_cell(cell_id)
  or exists (
    select 1 from public.people pe
    where pe.id = cell_rsvps.person_id
      and pe.person_user_id = auth.uid()
  )
);

drop policy if exists "cell_rsvps_insert_effective_roles" on public.cell_rsvps;
create policy "cell_rsvps_insert_effective_roles"
on public.cell_rsvps for insert to authenticated
with check (
  church_id = public.current_app_church_id()
  and (
    public.current_app_can_operate_cell(cell_id)
    or exists (
      select 1 from public.people pe
      where pe.id = cell_rsvps.person_id
        and pe.person_user_id = auth.uid()
    )
  )
);

drop policy if exists "cell_rsvps_update_effective_roles" on public.cell_rsvps;
create policy "cell_rsvps_update_effective_roles"
on public.cell_rsvps for update to authenticated
using (
  public.current_app_can_operate_cell(cell_id)
  or exists (
    select 1 from public.people pe
    where pe.id = cell_rsvps.person_id
      and pe.person_user_id = auth.uid()
  )
)
with check (
  church_id = public.current_app_church_id()
  and (
    public.current_app_can_operate_cell(cell_id)
    or exists (
      select 1 from public.people pe
      where pe.id = cell_rsvps.person_id
        and pe.person_user_id = auth.uid()
    )
  )
);

drop policy if exists "checkins_select_effective_roles" on public.checkins;
create policy "checkins_select_effective_roles"
on public.checkins for select to authenticated
using (public.current_app_can_view_cell(cell_id));

drop policy if exists "checkins_insert_effective_roles" on public.checkins;
create policy "checkins_insert_effective_roles"
on public.checkins for insert to authenticated
with check (
  church_id = public.current_app_church_id()
  and public.current_app_can_view_cell(cell_id)
);

drop policy if exists "pastoral_reminders_select_effective_roles" on public.pastoral_reminders;
create policy "pastoral_reminders_select_effective_roles"
on public.pastoral_reminders for select to authenticated
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.current_app_can_operate_cell(cell_id)
  or public.current_app_can_manage_person(person_id)
);

drop policy if exists "pastoral_reminders_insert_effective_roles" on public.pastoral_reminders;
create policy "pastoral_reminders_insert_effective_roles"
on public.pastoral_reminders for insert to authenticated
with check (
  church_id = public.current_app_church_id()
  and (
    public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or public.current_app_has_role('supervisor')
    or public.current_app_has_role('leader')
  )
);

drop policy if exists "pastoral_reminders_update_effective_roles" on public.pastoral_reminders;
create policy "pastoral_reminders_update_effective_roles"
on public.pastoral_reminders for update to authenticated
using (
  church_id = public.current_app_church_id()
  and (
    assigned_to = auth.uid()
    or created_by = auth.uid()
    or public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
  )
)
with check (
  church_id = public.current_app_church_id()
  and (
    assigned_to = auth.uid()
    or created_by = auth.uid()
    or public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
  )
);

drop policy if exists "peace_pairs_select_effective_roles" on public.peace_pairs;
create policy "peace_pairs_select_effective_roles"
on public.peace_pairs for select to authenticated
using (
  created_by = auth.uid()
  or public.current_app_can_operate_cell(cell_id)
);

drop policy if exists "peace_pairs_insert_effective_roles" on public.peace_pairs;
create policy "peace_pairs_insert_effective_roles"
on public.peace_pairs for insert to authenticated
with check (
  church_id = public.current_app_church_id()
  and (
    public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or public.current_app_has_role('supervisor')
    or public.current_app_has_role('leader')
  )
);

drop policy if exists "peace_pairs_update_effective_roles" on public.peace_pairs;
create policy "peace_pairs_update_effective_roles"
on public.peace_pairs for update to authenticated
using (created_by = auth.uid() or public.current_app_can_operate_cell(cell_id))
with check (
  church_id = public.current_app_church_id()
  and (created_by = auth.uid() or public.current_app_can_operate_cell(cell_id))
);

drop policy if exists "peace_pairs_delete_effective_roles" on public.peace_pairs;
create policy "peace_pairs_delete_effective_roles"
on public.peace_pairs for delete to authenticated
using (created_by = auth.uid() or public.current_app_can_operate_cell(cell_id));

drop policy if exists "peace_houses_select_effective_roles" on public.peace_houses;
create policy "peace_houses_select_effective_roles"
on public.peace_houses for select to authenticated
using (
  created_by = auth.uid()
  or public.current_app_can_operate_cell(cell_id)
);

drop policy if exists "peace_houses_insert_effective_roles" on public.peace_houses;
create policy "peace_houses_insert_effective_roles"
on public.peace_houses for insert to authenticated
with check (
  church_id = public.current_app_church_id()
  and (
    public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or public.current_app_has_role('supervisor')
    or public.current_app_has_role('leader')
  )
);

drop policy if exists "peace_houses_update_effective_roles" on public.peace_houses;
create policy "peace_houses_update_effective_roles"
on public.peace_houses for update to authenticated
using (created_by = auth.uid() or public.current_app_can_operate_cell(cell_id))
with check (
  church_id = public.current_app_church_id()
  and (created_by = auth.uid() or public.current_app_can_operate_cell(cell_id))
);

drop policy if exists "peace_houses_delete_effective_roles" on public.peace_houses;
create policy "peace_houses_delete_effective_roles"
on public.peace_houses for delete to authenticated
using (created_by = auth.uid() or public.current_app_can_operate_cell(cell_id));

drop policy if exists "library_materials_effective_roles" on public.library_materials;
create policy "library_materials_effective_roles"
on public.library_materials for select to authenticated
using (
  church_id = public.current_app_church_id()
  and (
    public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or public.current_app_has_role('supervisor')
    or (public.current_app_has_role('leader') and audience in ('member', 'leader'))
    or (public.current_app_has_role('member') and audience = 'member')
  )
);

drop policy if exists "certificates_select_effective_roles" on public.certificates;
create policy "certificates_select_effective_roles"
on public.certificates for select to authenticated
using (
  exists (
    select 1 from public.people pe
    where pe.id = certificates.person_id
      and public.can_view_person(pe)
  )
);

drop policy if exists "certificates_insert_effective_roles" on public.certificates;
create policy "certificates_insert_effective_roles"
on public.certificates for insert to authenticated
with check (
  church_id = public.current_app_church_id()
  and (
    public.current_app_has_role('admin')
    or public.current_app_has_role('pastor')
    or (
      public.current_app_has_role('leader')
      and public.current_app_can_manage_person(person_id)
    )
  )
);

drop policy if exists "person_track_access_effective_roles" on public.person_track_access;
create policy "person_track_access_effective_roles"
on public.person_track_access for insert to authenticated
with check (public.current_app_can_manage_person(person_id));

drop policy if exists "video_progress_select_effective_roles" on public.video_progress;
create policy "video_progress_select_effective_roles"
on public.video_progress for select to authenticated
using (
  exists (
    select 1
    from public.people pe
    where pe.id = video_progress.person_id
      and public.can_view_person(pe)
  )
);

drop policy if exists "video_progress_insert_effective_roles" on public.video_progress;
create policy "video_progress_insert_effective_roles"
on public.video_progress for insert to authenticated
with check (
  exists (
    select 1
    from public.people pe
    where pe.id = video_progress.person_id
      and public.can_view_person(pe)
      and (
        pe.person_user_id = auth.uid()
        or public.current_app_has_role('admin')
        or public.current_app_has_role('pastor')
        or (public.current_app_has_role('leader') and public.current_app_can_manage_person(pe.id))
      )
  )
);

drop policy if exists "video_progress_update_effective_roles" on public.video_progress;
create policy "video_progress_update_effective_roles"
on public.video_progress for update to authenticated
using (
  exists (
    select 1
    from public.people pe
    where pe.id = video_progress.person_id
      and public.can_view_person(pe)
      and (
        pe.person_user_id = auth.uid()
        or public.current_app_has_role('admin')
        or public.current_app_has_role('pastor')
        or (public.current_app_has_role('leader') and public.current_app_can_manage_person(pe.id))
      )
  )
)
with check (
  exists (
    select 1
    from public.people pe
    where pe.id = video_progress.person_id
      and public.can_view_person(pe)
      and (
        pe.person_user_id = auth.uid()
        or public.current_app_has_role('admin')
        or public.current_app_has_role('pastor')
        or (public.current_app_has_role('leader') and public.current_app_can_manage_person(pe.id))
      )
  )
);

drop policy if exists "video_reflections_select_effective_roles" on public.video_reflections;
create policy "video_reflections_select_effective_roles"
on public.video_reflections for select to authenticated
using (
  exists (
    select 1
    from public.people pe
    where pe.id = video_reflections.person_id
      and public.can_view_person(pe)
  )
);

drop policy if exists "video_reflections_insert_effective_roles" on public.video_reflections;
create policy "video_reflections_insert_effective_roles"
on public.video_reflections for insert to authenticated
with check (
  exists (
    select 1
    from public.people pe
    where pe.id = video_reflections.person_id
      and public.can_view_person(pe)
      and (
        pe.person_user_id = auth.uid()
        or public.current_app_has_role('admin')
        or public.current_app_has_role('pastor')
        or (public.current_app_has_role('leader') and public.current_app_can_manage_person(pe.id))
      )
  )
);

drop policy if exists "video_reflections_update_effective_roles" on public.video_reflections;
create policy "video_reflections_update_effective_roles"
on public.video_reflections for update to authenticated
using (
  exists (
    select 1
    from public.people pe
    where pe.id = video_reflections.person_id
      and public.can_view_person(pe)
      and (
        pe.person_user_id = auth.uid()
        or public.current_app_has_role('admin')
        or public.current_app_has_role('pastor')
        or (public.current_app_has_role('leader') and public.current_app_can_manage_person(pe.id))
      )
  )
)
with check (
  exists (
    select 1
    from public.people pe
    where pe.id = video_reflections.person_id
      and public.can_view_person(pe)
      and (
        pe.person_user_id = auth.uid()
        or public.current_app_has_role('admin')
        or public.current_app_has_role('pastor')
        or (public.current_app_has_role('leader') and public.current_app_can_manage_person(pe.id))
      )
  )
);

drop policy if exists "pastoral_notes_select_effective_roles" on public.pastoral_notes;
create policy "pastoral_notes_select_effective_roles"
on public.pastoral_notes for select to authenticated
using (
  exists (
    select 1
    from public.people pe
    where pe.id = pastoral_notes.person_id
      and public.can_view_person(pe)
      and (
        pastoral_notes.visibility = 'member_visible'
        or (
          pastoral_notes.visibility = 'pastor_private'
          and (public.current_app_has_role('admin') or public.current_app_has_role('pastor'))
        )
        or (
          pastoral_notes.visibility = 'leadership_private'
          and (
            public.current_app_has_role('admin')
            or public.current_app_has_role('pastor')
            or public.current_app_has_role('supervisor')
            or public.current_app_has_role('leader')
            or public.current_app_has_role('consolidation')
            or public.current_app_has_role('communication')
          )
        )
      )
  )
);

drop policy if exists "pastoral_notes_insert_effective_roles" on public.pastoral_notes;
create policy "pastoral_notes_insert_effective_roles"
on public.pastoral_notes for insert to authenticated
with check (
  exists (
    select 1
    from public.people pe
    where pe.id = pastoral_notes.person_id
      and public.can_view_person(pe)
      and (
        public.current_app_has_role('admin')
        or public.current_app_has_role('pastor')
        or public.current_app_has_role('supervisor')
        or public.current_app_has_role('leader')
        or public.current_app_has_role('consolidation')
        or public.current_app_has_role('communication')
      )
  )
);

drop policy if exists "prayer_requests_select_effective_roles" on public.prayer_requests;
create policy "prayer_requests_select_effective_roles"
on public.prayer_requests for select to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.people pe
    where pe.id = prayer_requests.person_id
      and public.can_view_person(pe)
      and (
        pe.person_user_id = auth.uid()
        or (
          prayer_requests.visibility = 'leader_only'
          and public.current_app_has_role('leader')
        )
        or (
          prayer_requests.visibility = 'leadership'
          and (
            public.current_app_has_role('admin')
            or public.current_app_has_role('pastor')
            or public.current_app_has_role('supervisor')
            or public.current_app_has_role('leader')
          )
        )
        or (
          prayer_requests.visibility = 'pastor_only'
          and (public.current_app_has_role('admin') or public.current_app_has_role('pastor'))
        )
        or prayer_requests.visibility = 'cell_public'
      )
  )
);

drop policy if exists "prayer_requests_insert_effective_roles" on public.prayer_requests;
create policy "prayer_requests_insert_effective_roles"
on public.prayer_requests for insert to authenticated
with check (
  church_id = public.current_app_church_id()
  and exists (
    select 1
    from public.people pe
    where pe.id = prayer_requests.person_id
      and (
        pe.person_user_id = auth.uid()
        or public.current_app_can_manage_person(pe.id)
      )
  )
);

drop policy if exists "prayer_requests_update_effective_roles" on public.prayer_requests;
create policy "prayer_requests_update_effective_roles"
on public.prayer_requests for update to authenticated
using (public.current_app_can_manage_person(person_id))
with check (
  church_id = public.current_app_church_id()
  and public.current_app_can_manage_person(person_id)
);

drop policy if exists "activity_events_select_effective_roles" on public.activity_events;
create policy "activity_events_select_effective_roles"
on public.activity_events for select to authenticated
using (
  church_id = public.current_app_church_id()
  and (
    actor_user_id = auth.uid()
    or exists (
      select 1
      from unnest(coalesce(activity_events.target_roles, '{}'::public.app_role[])) target_role
      where public.current_app_has_role(target_role)
    )
    or (
      (public.current_app_has_role('admin') or public.current_app_has_role('pastor'))
      and visibility <> 'member'
    )
    or (cell_id is not null and public.current_app_can_operate_cell(cell_id))
    or (person_id is not null and public.current_app_can_manage_person(person_id))
    or (public.current_app_has_role('communication') and visibility = 'member')
  )
);
