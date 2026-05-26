-- Ovelhas - verificacao rapida do Supabase
-- Rode depois dos arquivos da SETUP_ORDEM.md.

select 'profiles' as item, to_regclass('public.profiles') is not null as ok
union all select 'churches', to_regclass('public.churches') is not null
union all select 'cells', to_regclass('public.cells') is not null
union all select 'people', to_regclass('public.people') is not null
union all select 'invites', to_regclass('public.invites') is not null
union all select 'cell_rsvps', to_regclass('public.cell_rsvps') is not null
union all select 'discipleship_tracks', to_regclass('public.discipleship_tracks') is not null
union all select 'video_progress', to_regclass('public.video_progress') is not null
union all select 'prayer_requests', to_regclass('public.prayer_requests') is not null
union all select 'pastoral_reminders', to_regclass('public.pastoral_reminders') is not null
union all select 'current_app_user()', to_regprocedure('public.current_app_user()') is not null
union all select 'current_app_role()', to_regprocedure('public.current_app_role()') is not null
union all select 'can_admin_church(uuid)', to_regprocedure('public.can_admin_church(uuid)') is not null
union all select 'accept_invite(text)', to_regprocedure('public.accept_invite(text)') is not null
union all select 'accept_invite_for_user(uuid,text,text)', to_regprocedure('public.accept_invite_for_user(uuid,text,text)') is not null;

select
  p.id,
  p.name,
  p.role,
  p.church_id,
  count(c.id) filter (where c.leader_id = p.id) as lidera_celulas,
  count(c.id) filter (where c.supervisor_id = p.id) as supervisiona_celulas
from public.profiles p
left join public.cells c
  on c.leader_id = p.id
  or c.supervisor_id = p.id
group by p.id, p.name, p.role, p.church_id
order by p.created_at desc;

select
  status,
  role,
  count(*) as total
from public.invites
group by status, role
order by status, role;
