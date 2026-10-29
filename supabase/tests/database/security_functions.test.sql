begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

select function_privs_are(
  'public',
  'consume_api_rate_limit',
  array['text', 'integer', 'integer'],
  'anon',
  array[]::text[],
  'anon nao executa o rate limit compartilhado'
);

select function_privs_are(
  'public',
  'consume_api_rate_limit',
  array['text', 'integer', 'integer'],
  'authenticated',
  array[]::text[],
  'cliente autenticado nao executa diretamente o rate limit compartilhado'
);

select function_privs_are(
  'public',
  'consume_api_rate_limit',
  array['text', 'integer', 'integer'],
  'service_role',
  array['EXECUTE'],
  'somente o service role executa o rate limit compartilhado'
);

select function_privs_are(
  'public',
  'update_profile_additional_roles',
  array['uuid', 'app_role[]'],
  'anon',
  array[]::text[],
  'anon nao altera funcoes adicionais'
);

select function_privs_are(
  'public',
  'update_profile_additional_roles',
  array['uuid', 'app_role[]'],
  'authenticated',
  array['EXECUTE'],
  'usuario autenticado acessa a RPC protegida por verificacao interna'
);

insert into public.churches (id, name) values
  ('cccccccc-0000-0000-0000-000000000001', 'Igreja C'),
  ('dddddddd-0000-0000-0000-000000000001', 'Igreja D');

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data
) values
  ('cccccccc-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'admin-c@example.test', '', '{}', '{"name":"Admin C"}'),
  ('cccccccc-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'member-c@example.test', '', '{}', '{"name":"Member C"}'),
  ('dddddddd-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'member-d@example.test', '', '{}', '{"name":"Member D"}');

insert into public.profiles (id, church_id, name, role)
values
  ('cccccccc-0000-0000-0000-000000000011', 'cccccccc-0000-0000-0000-000000000001', 'Admin C', 'admin'),
  ('cccccccc-0000-0000-0000-000000000012', 'cccccccc-0000-0000-0000-000000000001', 'Member C', 'member'),
  ('dddddddd-0000-0000-0000-000000000012', 'dddddddd-0000-0000-0000-000000000001', 'Member D', 'member')
on conflict (id) do update set
  church_id = excluded.church_id,
  name = excluded.name,
  role = excluded.role,
  additional_roles = '{}';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000011', true);

select lives_ok(
  $$select public.update_profile_additional_roles(
      'cccccccc-0000-0000-0000-000000000012',
      array['leader']::public.app_role[]
    )$$,
  'admin pode atribuir funcao adicional permitida na propria igreja'
);

select is(
  (
    select additional_roles
    from public.profiles
    where id = 'cccccccc-0000-0000-0000-000000000012'
  ),
  array['leader']::public.app_role[],
  'RPC persiste a funcao adicional normalizada'
);

select throws_ok(
  $$select public.update_profile_additional_roles(
      'cccccccc-0000-0000-0000-000000000012',
      array['admin']::public.app_role[]
    )$$,
  'P0001',
  'Funcao adicional nao permitida.',
  'RPC impede escalada para admin por funcao adicional'
);

select throws_ok(
  $$select public.update_profile_additional_roles(
      'dddddddd-0000-0000-0000-000000000012',
      array['leader']::public.app_role[]
    )$$,
  'P0001',
  'Apenas admin ou pastor da mesma igreja podem alterar funcoes adicionais.',
  'RPC impede alteracao de usuario de outra igreja'
);

select * from finish();
rollback;
