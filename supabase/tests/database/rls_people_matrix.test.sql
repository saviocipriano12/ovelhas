begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.people'::regclass),
  'RLS esta habilitado em people'
);

select policies_are(
  'public',
  'people',
  array[
    'people_delete_by_responsibility',
    'people_insert_by_responsibility_safe',
    'people_insert_effective_roles',
    'people_select_by_responsibility',
    'people_update_by_responsibility_safe',
    'people_update_effective_roles',
    'people_update_profile_by_responsibility'
  ],
  'people possui somente o conjunto esperado de policies'
);

insert into public.churches (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Igreja A'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Igreja B');

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data
) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'admin-a@example.test', '', '{}', '{"name":"Admin A"}'),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'pastor-a@example.test', '', '{}', '{"name":"Pastor A"}'),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'authenticated', 'authenticated', 'supervisor-a@example.test', '', '{}', '{"name":"Supervisor A"}'),
  ('aaaaaaaa-0000-0000-0000-000000000014', 'authenticated', 'authenticated', 'leader-a@example.test', '', '{}', '{"name":"Leader A"}'),
  ('aaaaaaaa-0000-0000-0000-000000000015', 'authenticated', 'authenticated', 'member-a@example.test', '', '{}', '{"name":"Member A"}'),
  ('aaaaaaaa-0000-0000-0000-000000000016', 'authenticated', 'authenticated', 'member-leader-a@example.test', '', '{}', '{"name":"Member Leader A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'admin-b@example.test', '', '{}', '{"name":"Admin B"}');

insert into public.profiles (id, church_id, name, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'Admin A', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 'Pastor A', 'pastor'),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000001', 'Supervisor A', 'supervisor'),
  ('aaaaaaaa-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000001', 'Leader A', 'leader'),
  ('aaaaaaaa-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000001', 'Member A', 'member'),
  ('aaaaaaaa-0000-0000-0000-000000000016', 'aaaaaaaa-0000-0000-0000-000000000001', 'Member Leader A', 'member'),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000001', 'Admin B', 'admin')
on conflict (id) do update set
  church_id = excluded.church_id,
  name = excluded.name,
  role = excluded.role;

update public.profiles
set additional_roles = array['leader']::public.app_role[]
where id = 'aaaaaaaa-0000-0000-0000-000000000016';

insert into public.cells (id, church_id, name, leader_id, supervisor_id) values
  ('aaaaaaaa-0000-0000-0000-000000000101', 'aaaaaaaa-0000-0000-0000-000000000001', 'Celula A1', 'aaaaaaaa-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000013'),
  ('aaaaaaaa-0000-0000-0000-000000000102', 'aaaaaaaa-0000-0000-0000-000000000001', 'Celula A2', 'aaaaaaaa-0000-0000-0000-000000000016', null),
  ('bbbbbbbb-0000-0000-0000-000000000101', 'bbbbbbbb-0000-0000-0000-000000000001', 'Celula B1', null, null);

insert into public.people (
  id,
  church_id,
  cell_id,
  person_user_id,
  created_by_user_id,
  leader_user_id,
  name
) values
  ('aaaaaaaa-0000-0000-0000-000000001001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000101', null, 'aaaaaaaa-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000014', 'Pessoa A1'),
  ('aaaaaaaa-0000-0000-0000-000000001002', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000102', null, 'aaaaaaaa-0000-0000-0000-000000000016', null, 'Pessoa A2'),
  ('aaaaaaaa-0000-0000-0000-000000001003', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000101', 'aaaaaaaa-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000014', 'Membro A'),
  ('bbbbbbbb-0000-0000-0000-000000001001', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000101', null, 'bbbbbbbb-0000-0000-0000-000000000011', null, 'Pessoa B1');

set local role authenticated;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000011', true);
select is((select count(*) from public.people), 3::bigint, 'admin ve somente as pessoas da propria igreja');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000012', true);
select is((select count(*) from public.people), 3::bigint, 'pastor ve somente as pessoas da propria igreja');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000013', true);
select is((select count(*) from public.people), 2::bigint, 'supervisor ve somente pessoas das celulas supervisionadas');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000014', true);
select is((select count(*) from public.people), 2::bigint, 'lider ve somente pessoas sob sua responsabilidade');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000015', true);
select is((select count(*) from public.people), 1::bigint, 'membro ve somente o proprio cadastro');

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000011', true);
select is((select count(*) from public.people), 1::bigint, 'admin de outra igreja nao ve dados da igreja A');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000016', true);
select is((select count(*) from public.people), 1::bigint, 'papel adicional de lider amplia o escopo somente sobre pessoas sob responsabilidade');
select is((select count(*) from public.cells), 1::bigint, 'papel adicional de lider ve somente a celula sob sua responsabilidade');

select lives_ok(
  $$insert into public.people (
      id, church_id, cell_id, created_by_user_id, leader_user_id, name
    ) values (
      'aaaaaaaa-0000-0000-0000-000000001004',
      'aaaaaaaa-0000-0000-0000-000000000001',
      'aaaaaaaa-0000-0000-0000-000000000102',
      'aaaaaaaa-0000-0000-0000-000000000016',
      'aaaaaaaa-0000-0000-0000-000000000016',
      'Pessoa criada por papel adicional'
    )$$,
  'papel adicional de lider pode incluir pessoa na propria celula'
);

select throws_ok(
  $$insert into public.people (
      id, church_id, cell_id, created_by_user_id, leader_user_id, name
    ) values (
      'aaaaaaaa-0000-0000-0000-000000001005',
      'aaaaaaaa-0000-0000-0000-000000000001',
      'aaaaaaaa-0000-0000-0000-000000000101',
      'aaaaaaaa-0000-0000-0000-000000000016',
      'aaaaaaaa-0000-0000-0000-000000000016',
      'Pessoa fora do escopo'
    )$$,
  null,
  null,
  'papel adicional de lider nao pode incluir pessoa fora da propria celula'
);

select * from finish();
rollback;
