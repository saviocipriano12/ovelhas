-- Ovelhas - conecta check-in por QR a presenca real
-- Rode depois de schema.sql, attendance.sql e checkins.sql.
-- Sem isso, quem faz check-in continua aparecendo como ausente para o lider.

create or replace function public.record_checkin_attendance(
  p_cell_id uuid,
  p_person_id uuid,
  p_checkin_type text,
  p_checkin_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_cell public.cells;
  target_person public.people;
  meeting_id uuid;
  service_id uuid;
  authorized boolean;
begin
  if auth.uid() is null or p_person_id is null then
    return;
  end if;

  select * into target_cell from public.cells where id = p_cell_id;
  if target_cell.id is null then
    return;
  end if;

  select * into target_person from public.people where id = p_person_id and church_id = target_cell.church_id;
  if target_person.id is null then
    return;
  end if;

  authorized := target_person.person_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and p.church_id = target_cell.church_id
      and (
        p.role in ('admin', 'pastor')
        or (p.role = 'supervisor' and target_cell.supervisor_id = p.id)
        or (p.role = 'leader' and target_cell.leader_id = p.id)
      )
    );

  if not authorized then
    return;
  end if;

  if p_checkin_type = 'service' then
    select id into service_id
    from public.church_services
    where church_id = target_cell.church_id and service_date = p_checkin_date
    limit 1;

    if service_id is null then
      insert into public.church_services (church_id, service_date, created_by)
      values (target_cell.church_id, p_checkin_date, auth.uid())
      returning id into service_id;
    end if;

    insert into public.service_attendance (service_id, person_id, present)
    values (service_id, p_person_id, true)
    on conflict (service_id, person_id) do update set present = true;

    return;
  end if;

  select id into meeting_id
  from public.cell_meetings
  where cell_id = p_cell_id and meeting_date = p_checkin_date
  limit 1;

  if meeting_id is null then
    insert into public.cell_meetings (cell_id, meeting_date, created_by)
    values (p_cell_id, p_checkin_date, auth.uid())
    returning id into meeting_id;
  end if;

  insert into public.cell_attendance (meeting_id, person_id, present)
  values (meeting_id, p_person_id, true)
  on conflict (meeting_id, person_id) do update set present = true;
end;
$$;

grant execute on function public.record_checkin_attendance(uuid, uuid, text, date) to authenticated;
