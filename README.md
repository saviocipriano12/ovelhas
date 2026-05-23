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
