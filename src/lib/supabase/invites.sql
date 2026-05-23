-- Ovelhas - convites por link
-- Rode depois de schema.sql e admin-management.sql.

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  token text not null unique,
  email text,
  name text,
  role app_role not null default 'member',
  cell_id uuid references public.cells(id) on delete set null,
  created_by uuid references public.profiles(id),
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

drop policy if exists "invites_select_by_token_or_leadership" on public.invites;
create policy "invites_select_by_token_or_leadership"
on public.invites
for select
using (
  status = 'pending'
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = invites.church_id
    and p.role in ('admin', 'pastor', 'supervisor', 'leader')
  )
);

drop policy if exists "invites_insert_by_leadership" on public.invites;
create policy "invites_insert_by_leadership"
on public.invites
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = invites.church_id
    and (
      p.role in ('admin', 'pastor')
      or (
        p.role = 'leader'
        and invites.role = 'member'
        and exists (
          select 1
          from public.cells c
          where c.id = invites.cell_id
          and c.leader_id = p.id
        )
      )
    )
  )
);

drop policy if exists "invites_update_by_admin_or_creator" on public.invites;
create policy "invites_update_by_admin_or_creator"
on public.invites
for update
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = invites.church_id
    and p.role in ('admin', 'pastor')
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.church_id = invites.church_id
    and p.role in ('admin', 'pastor')
  )
);

create or replace function public.accept_invite(invite_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invite public.invites;
  auth_email text;
  existing_person_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select *
  into target_invite
  from public.invites
  where token = invite_token
  and status = 'pending'
  and expires_at > now()
  limit 1;

  if target_invite.id is null then
    raise exception 'Convite invalido ou expirado.';
  end if;

  select email
  into auth_email
  from auth.users
  where id = auth.uid();

  if target_invite.email is not null and target_invite.email <> '' and lower(target_invite.email) <> lower(auth_email) then
    raise exception 'Este convite pertence a outro email.';
  end if;

  update public.profiles
  set
    church_id = target_invite.church_id,
    role = target_invite.role,
    name = coalesce(nullif(target_invite.name, ''), name)
  where id = auth.uid();

  if target_invite.role = 'leader' and target_invite.cell_id is not null then
    update public.cells
    set leader_id = auth.uid()
    where id = target_invite.cell_id
    and church_id = target_invite.church_id;
  end if;

  if target_invite.role = 'member' then
    select id
    into existing_person_id
    from public.people
    where person_user_id = auth.uid()
    or (target_invite.email is not null and email = target_invite.email and church_id = target_invite.church_id)
    limit 1;

    if existing_person_id is null then
      insert into public.people (
        church_id,
        cell_id,
        person_user_id,
        created_by_user_id,
        leader_user_id,
        name,
        email,
        status,
        journey_stage,
        first_visit_date
      )
      values (
        target_invite.church_id,
        target_invite.cell_id,
        auth.uid(),
        target_invite.created_by,
        target_invite.created_by,
        coalesce(nullif(target_invite.name, ''), auth_email),
        auth_email,
        'Novo membro',
        'Primeiros passos',
        current_date
      );
    else
      update public.people
      set
        person_user_id = auth.uid(),
        cell_id = coalesce(cell_id, target_invite.cell_id),
        leader_user_id = coalesce(leader_user_id, target_invite.created_by)
      where id = existing_person_id;
    end if;
  end if;

  update public.invites
  set
    status = 'accepted',
    accepted_by = auth.uid(),
    accepted_at = now()
  where id = target_invite.id;
end;
$$;
