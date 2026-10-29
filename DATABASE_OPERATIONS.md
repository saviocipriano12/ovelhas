# Operacao segura do banco

Este documento define o fluxo para aplicar migrations do Ovelhas. Nunca edite uma migration que ja tenha sido aplicada em um ambiente compartilhado.

## Validacao local obrigatoria

Com Docker Desktop em execucao e virtualizacao/hypervisor habilitados no Windows:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
```

O `db:reset` precisa recriar o banco do zero. O `db:test` precisa validar a matriz RLS antes de qualquer envio para staging.
O atalho `npm run db:check` executa toda essa sequencia, incluindo a verificacao dos baselines imutaveis.

O workflow `.github/workflows/database-tests.yml` repete o mesmo portao em Linux em pull requests e pushes para `main` que alterem o banco.

## Staging

Vincule o repositorio somente ao projeto de staging:

```bash
npx --yes supabase@2.120.0 link --project-ref SEU_PROJECT_REF_DE_STAGING
npx --yes supabase@2.120.0 db push --linked --dry-run
npx --yes supabase@2.120.0 db push --linked
```

Depois do push, execute os fluxos de acesso com contas de teste de duas igrejas diferentes.

## Backup antes de producao

Os arquivos da pasta `backups` sao ignorados pelo Git porque podem conter dados pessoais.

```bash
npx --yes supabase@2.120.0 db dump --linked --schema public,auth,storage --file backups/pre-migration-schema.sql
npx --yes supabase@2.120.0 db dump --linked --data-only --use-copy --schema public --file backups/pre-migration-data.sql
```

Confirme tambem a disponibilidade do backup gerenciado/PITR no painel do Supabase antes de uma migration destrutiva.

## Producao

1. Confirmar que o mesmo conjunto passou no banco local e em staging.
2. Criar o backup.
3. Executar primeiro o dry-run.
4. Aplicar somente migrations ainda nao registradas.
5. Rodar o health-check e os testes de fumaca da aplicacao.

```bash
npx --yes supabase@2.120.0 db push --linked --dry-run
npx --yes supabase@2.120.0 db push --linked
```

## Rollback

Uma migration ja aplicada nao deve ser reescrita. Para mudancas reversiveis, crie uma migration corretiva que restaure o schema anterior. Para perda ou corrupcao de dados, interrompa novas escritas e restaure o backup/PITR antes de retomar a aplicacao.

`supabase migration repair` altera apenas o historico das migrations. Ele nao desfaz alteracoes de schema ou recupera dados e nao deve ser usado como rollback de banco.
