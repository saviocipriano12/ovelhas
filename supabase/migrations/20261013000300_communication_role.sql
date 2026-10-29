-- A role precisa ser confirmada em uma transacao anterior ao uso nas funcoes
-- e policies da migration de hardening.
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role'
      and e.enumlabel = 'communication'
  ) then
    alter type public.app_role add value 'communication';
  end if;
end;
$$;
