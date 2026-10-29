# Ovelhas

Plataforma mobile-first de cuidado pastoral, celulas, presencas, discipulado em video e relatorios.

By Savio Cipriano.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra:

```txt
http://localhost:3000
```

## Supabase

Crie um arquivo `.env.local` com:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

O schema e as regras RLS sao versionados em `supabase/migrations`. Com Docker ativo, recrie e valide o banco completo com:

```bash
npm run db:check
```

O fluxo manual antigo pelo SQL Editor continua documentado apenas para manutencao de instalacoes existentes:

```txt
src/lib/supabase/SETUP_ORDEM.md
```

Pull requests que alteram `supabase/**` tambem executam migrations, lint e pgTAP no workflow `database-tests`.

## Validacao tecnica

```bash
npm run lint
npm test
npm run build
npm run audit:prod
npm run native:doctor
```

O plano sequencial de evolucao e os criterios de conclusao estao em:

```txt
EXECUTION_PLAN.md
```

Com uma conta logada, acesse:

```txt
/configuracao
```

Essa tela cria a primeira igreja e promove seu usuario para administrador.

## Rotas principais

- `/dashboard`
- `/instalar`
- `/celulas`
- `/pessoas`
- `/presenca`
- `/checkin`
- `/cuidados`
- `/videos`
- `/biblioteca`
- `/notificacoes`
- `/relatorios`
- `/relatorios/novo`
- `/supervisao`
- `/gestao`
- `/atividades`
- `/meu-discipulado`
- `/acesso`

## Perfis

- Administrador
- Pastor
- Supervisor
- Lider
- Consolidacao
- Comunicacao
- Membro

## App no telefone

O Ovelhas ja pode ser instalado como PWA pela rota:

```txt
/instalar
```

Tambem existe preparo para app nativo com Capacitor. Veja:

```txt
NATIVE_APP.md
```
