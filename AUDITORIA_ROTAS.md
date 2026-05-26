# Auditoria de Rotas - Ovelhas

Data: 2026-05-26

## Base real

- Login real via Supabase Auth.
- Contas sem igreja ou membro sem pessoa vinculada caem em `/aguardando`.
- Primeiro admin cria a primeira igreja via `/configuracao`.
- Dados principais usam Supabase com RLS: igrejas, perfis, celulas, pessoas, convites, presencas, relatorios, discipulado, cuidados e auditoria.
- Em producao, as telas confiam no escopo retornado pelo Supabase e nao aplicam filtros locais duplicados que escondiam dados apos atualizar a pagina.

## Hierarquia validada

- Admin: ve e configura a igreja inteira, cria convites para qualquer papel, cria celulas, pessoas, conteudo e relatorios.
- Pastor: ve a igreja atribuida, cria celulas, convites para supervisor/lider/membro, acompanha relatorios e configuracoes da igreja.
- Supervisor: ve as celulas sob sua supervisao, cria celulas sob sua responsabilidade, convida lideres/membros, registra supervisao e acompanha relatorios.
- Lider: ve sua celula, cria membros/visitantes, marca presenca, libera discipulado e acompanha cuidados.
- Membro: ve apenas area propria de discipulado, biblioteca permitida, pedidos de oracao e notificacoes.

## Rotas principais

- `/login`: login real, recuperacao de senha e criacao de nova senha apos link de recuperacao.
- `/aguardando`: bloqueio correto para conta sem igreja/celula/pessoa.
- `/configuracao`: bootstrap seguro do primeiro administrador.
- `/dashboard`: indicadores por escopo real do perfil.
- `/celulas`: cria e lista celulas persistidas; atualiza do Supabase apos refresh.
- `/convites`: cria links por papel, lista convites persistidos e mostra erros de RLS quando existirem.
- `/convite/[token]`: aceita convite com criar conta ou conta existente.
- `/pessoas`: cria e lista pessoas persistidas; recarrega Supabase apos cadastro.
- `/presenca`: marca presenca de celula e culto, usa confirmacoes do membro e gera cuidados por ausencia.
- `/relatorios` e `/relatorios/novo`: cria relatorio, consolida indicadores e exporta arquivo bonito.
- `/supervisao`: registra visita/acompanhamento de supervisor.
- `/gestao`: atribui supervisor/lider e mostra lacunas de responsabilidade.
- `/videos`: cria trilhas/videos e libera discipulado para pessoas visiveis.
- `/meu-discipulado`: painel do membro com progresso e confirmacao de presenca.
- `/agenda`, `/cuidados`, `/oracao`, `/biblioteca`, `/atividades`, `/notificacoes`: usam escopo real de producao.
- `/instalar`, `/offline`: PWA/mobile.

## Pontos ainda de evolucao SaaS

- Multi-tenant completo para varias igrejas independentes precisa de uma camada de `platform_admin` ou tabela de membros por igreja. Hoje cada usuario tem um `church_id` principal.
- Troca de uma pessoa entre igrejas diferentes ainda nao deve ser feita pelo app.
- Push notification real em background depende de servidor/fila externa; hoje ha notificacoes locais/PWA e lembretes no app.
- Upload real de videos para storage ainda pode evoluir; hoje o fluxo aceita URL de video.
- Auditoria imutavel e logs administrativos profundos devem virar uma tabela propria antes de cobrar como SaaS.
