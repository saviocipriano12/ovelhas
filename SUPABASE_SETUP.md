# Configuracao Supabase do Ovelhas

## Variaveis locais

O arquivo `.env.local` ja foi criado com:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

O `.env.local` esta ignorado pelo Git.

## Criar tabelas

1. Abra o Supabase.
2. Va em `SQL Editor`.
3. Cole o conteudo de `src/lib/supabase/schema.sql`.
4. Execute.

Depois rode tambem:

```txt
src/lib/supabase/signup-profile.sql
```

Esse complemento cria automaticamente um registro em `profiles` quando alguem se cadastra pelo Supabase Auth.

Para liberar a primeira configuracao pelo app, rode tambem:

```txt
src/lib/supabase/bootstrap.sql
```

Depois acesse `/configuracao` logado para criar a primeira igreja e transformar seu usuario em administrador.

Para ativar supervisao e prestacao de contas, rode:

```txt
src/lib/supabase/accountability.sql
```

Para liberar a tela de gestao de acessos, papeis e atribuicao de lider/supervisor por celula, rode:

```txt
src/lib/supabase/admin-management.sql
```

Para ativar presenca real de celula/culto e cuidados automaticos por ausencia, rode:

```txt
src/lib/supabase/attendance.sql
```

Para ativar trilhas, videos, liberacao de discipulado e progresso real do membro, rode:

```txt
src/lib/supabase/discipleship.sql
```

Para ativar convites por link para pastor, supervisor, lider e membro, rode:

```txt
src/lib/supabase/invites.sql
```

Para ativar perfil completo da pessoa e notas pastorais com niveis de visibilidade, rode:

```txt
src/lib/supabase/person-profile.sql
```

Para ativar agenda pastoral e lembretes reais, rode:

```txt
src/lib/supabase/pastoral-agenda.sql
```

Para ativar pedidos de oracao com niveis de privacidade, rode:

```txt
src/lib/supabase/prayer-requests.sql
```

## Estado da integracao no app

Ja existe:

- login real em `/login`;
- cadastro real via Supabase Auth;
- fallback para modo demonstracao;
- tela `/configuracao`;
- leitura inicial de `people` do Supabase quando houver dados.
- supervisao semanal de celulas;
- feed de atividades por papel.
- gestao de papeis e atribuicao de supervisor/lider por celula.
- presenca de celula e culto gravando no Supabase;
- criacao automatica de cuidados por ausencia consecutiva.
- trilhas e videos com cadastro real;
- liberacao de trilha para membro;
- progresso de videos gravando no Supabase.
- convites por link com papel, igreja e celula definidos.
- perfil completo da pessoa com edicao real;
- notas pastorais privadas por nivel de acesso.
- agenda pastoral com lembretes, visitas e proximos passos.
- pedidos de oracao com privacidade por lider, lideranca, pastor ou celula.

Ainda falta conectar escrita real para:

- upload de arquivos no Storage;
- notificacoes push;
- convites por link.

Esse SQL cria:

- churches
- profiles
- cells
- people
- cell_meetings
- cell_attendance
- cell_reports
- discipleship_tracks
- discipleship_videos
- person_track_access
- video_progress
- follow_ups

Tambem habilita RLS e cria as primeiras policies para:

- pastor/admin verem a igreja;
- supervisor ver celulas supervisionadas;
- lider ver propria celula;
- membro ver apenas o proprio registro;
- relatorios respeitarem acesso por celula.

## Sobre as chaves

Use no frontend apenas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

A chave publicavel nova da Supabase e suficiente para o frontend.

Nao coloque a `service_role` no frontend, no GitHub ou em `.env.local` de cliente.
