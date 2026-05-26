-- Ovelhas - complemento para cadastro via Supabase Auth
-- Rode no SQL Editor depois do schema.sql.
-- Contas criadas diretamente ficam sem church_id.
-- No app isso significa "aguardando liberacao": a pessoa nao acessa dados da igreja
-- ate aceitar um convite ou ser vinculada por um administrador.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Novo membro'),
    'member'
  )
  on conflict (id) do nothing;

  if new.raw_user_meta_data ? 'invite_token' then
    perform public.accept_invite_for_user(new.id, new.email, new.raw_user_meta_data->>'invite_token');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
