-- Ovelhas - perfil completo, notas pastorais e historico
-- Rode depois de schema.sql e admin-management.sql.

create table if not exists public.pastoral_notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  created_by uuid references public.profiles(id),
  note text not null,
  visibility text not null default 'leadership_private',
  created_at timestamptz not null default now()
);

alter table public.pastoral_notes enable row level security;

drop policy if exists "pastoral_notes_select_by_visibility" on public.pastoral_notes;
create policy "pastoral_notes_select_by_visibility"
on public.pastoral_notes
for select
using (
  exists (
    select 1
    from public.people person
    join public.profiles viewer on viewer.id = auth.uid()
    where person.id = pastoral_notes.person_id
    and public.can_view_person(person)
    and (
      pastoral_notes.visibility = 'member_visible'
      or (
        pastoral_notes.visibility = 'pastor_private'
        and viewer.role in ('admin', 'pastor')
      )
      or (
        pastoral_notes.visibility = 'leadership_private'
        and viewer.role in ('admin', 'pastor', 'supervisor', 'leader')
      )
    )
  )
);

drop policy if exists "pastoral_notes_insert_by_leadership" on public.pastoral_notes;
create policy "pastoral_notes_insert_by_leadership"
on public.pastoral_notes
for insert
with check (
  exists (
    select 1
    from public.people person
    join public.profiles viewer on viewer.id = auth.uid()
    where person.id = pastoral_notes.person_id
    and public.can_view_person(person)
    and viewer.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "people_update_profile_by_responsibility" on public.people;
create policy "people_update_profile_by_responsibility"
on public.people
for update
using (public.can_view_person(people))
with check (public.can_view_person(people));

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
