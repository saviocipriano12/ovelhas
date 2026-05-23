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

Para criar as tabelas e RLS, rode o SQL em:

```txt
src/lib/supabase/schema.sql
```

Depois rode:

```txt
src/lib/supabase/signup-profile.sql
src/lib/supabase/bootstrap.sql
```

Com uma conta logada, acesse:

```txt
/configuracao
```

Essa tela cria a primeira igreja e promove seu usuario para administrador.

## Rotas principais

- `/dashboard`
- `/celulas`
- `/pessoas`
- `/presenca`
- `/cuidados`
- `/videos`
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
- Membro
