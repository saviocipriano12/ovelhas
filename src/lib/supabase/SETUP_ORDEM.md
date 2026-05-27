# Ovelhas - ordem unica de configuracao Supabase

Use esta ordem sempre que criar ou corrigir um banco Supabase do Ovelhas.

## Caminho recomendado

Rode `full-setup.sql` no SQL Editor do Supabase para aplicar o nucleo da plataforma.

Depois rode `consolidation.sql` para aplicar o modulo de consolidacao e o papel `consolidation`.

Depois rode `health-check.sql` para conferir se tabelas e funcoes essenciais existem.

## Caminho manual

Se o Supabase reclamar por tamanho da consulta, rode um arquivo por vez nesta ordem, copiando o conteudo inteiro.

1. `schema.sql`
   Cria tabelas base, tipos, RLS inicial e politicas principais.

2. `bootstrap.sql`
   Cria a funcao de primeiro admin e a funcao segura `current_app_user`.

3. `admin-management.sql`
   Corrige politicas de `profiles`, cria funcoes seguras de papel/igreja e delega operacao: admin/pastor por igreja, supervisor por celula supervisionada e lider por celula liderada.

4. `invites.sql`
   Cria convites, busca publica segura por token, aceite de convite, regras de criacao por papel e aceite automatico por usuario.

5. `signup-profile.sql`
   Cria perfil quando nasce usuario no Supabase Auth e aplica convite automaticamente quando houver `invite_token`.

6. `accountability.sql`
   Cria visitas de supervisor e linha do tempo de atividades.

7. `attendance.sql`
   Cria presencas de culto, presencas de celula e follow-ups.

8. `cell-rsvps.sql`
   Cria confirmacao semanal do membro para a celula.

9. `checkins.sql`
   Cria check-in por QR/codigo.

10. `discipleship.sql`
    Cria trilhas, videos, liberacao de trilha, progresso e reflexoes dos videos.

11. `person-profile.sql`
    Cria notas pastorais e regras de edicao de perfil.

12. `pastoral-agenda.sql`
    Cria agenda e lembretes pastorais.

13. `prayer-requests.sql`
    Cria pedidos de oracao com visibilidade por papel.

14. `library-certificates.sql`
    Cria biblioteca e certificados.

15. `church-settings.sql`
    Cria configuracoes da igreja, mensagens e identidade. Admin e pastor podem alterar a igreja vinculada a eles.

16. `consolidation.sql`
    Cria o ministerio de consolidacao, libera o papel `consolidation`, registra cultos, visitantes, decisoes e encaminhamentos para celulas.

## Primeiro uso real

1. Garantir que a primeira conta admin ja exista ou criar a primeira conta temporariamente antes de fechar o cadastro publico.
2. Rodar todos os SQLs acima nesta ordem.
3. Entrar como admin.
4. Criar celulas em `/celulas`.
5. Criar convites em `/convites`.
6. Atribuir supervisor e lider em `/gestao`.
7. Rodar `consolidation.sql` se ele ainda nao estiver dentro do setup usado.
8. Rodar `health-check.sql` para conferir tabelas/funcoes essenciais.

## Matriz de acesso esperada

- Admin: ve tudo, cria igreja/celulas/convites, promove usuarios, atribui responsabilidades, acessa relatorios e configuracoes.
- Pastor: administra a igreja dele no dia a dia, cria celulas, convida supervisores/lideres/membros, acompanha relatorios, supervisao, atividades e configuracoes da igreja.
- Supervisor: cria e monitora celulas da sua supervisao, convida lideres/membros, acompanha pessoas, presencas, relatorios e visitas das celulas dele.
- Lider: ve sua celula, pessoas, presenca, check-in, convites de membro, libera discipulado, videos e cuidados.
- Consolidacao: registra cultos, visitantes, decisoes e sugestoes de encaminhamento para celulas. Pastor e admin acompanham esses dados.
- Membro: ve apenas o proprio discipulado, oracao, biblioteca, notificacoes, instalacao e mais.

## Teste minimo antes de publicar

1. Admin cria uma celula.
2. Admin cria convite de pastor e o pastor entra.
3. Admin cria convite de supervisor e atribui uma celula a ele.
4. Admin cria convite de lider vinculado a uma celula.
5. Lider cria convite de membro vinculado a sua celula.
6. Membro entra, cai em `/meu-discipulado`, confirma presenca semanal e nao ve areas administrativas.
7. Lider ve a confirmacao do membro em `/presenca`.
8. Supervisor ve a celula atribuida em `/supervisao`.
9. Pastor ve tudo em `/relatorios`, `/supervisao` e `/atividades`.
10. Convite aceito fica como `Aceito` em `/convites`.
11. Usuario de consolidacao entra em `/consolidacao`, registra um culto e o relatorio aparece em `/relatorios`.
