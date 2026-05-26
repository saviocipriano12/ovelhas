# Auditoria completa do Ovelhas

Data: 2026-05-25

## Diagnostico direto

O app compila e possui muitas telas prontas, mas ainda nao esta completamente funcional para uso real. O principal problema nao e visual: a camada de dados ainda mistura Supabase real com `localStorage` e dados de demonstracao. Isso cria estados falsos, convites que parecem pendentes, dashboards que nao refletem o banco e permissoes que parecem corretas em uma tela mas falham em outra.

Validacao tecnica executada:

- `npm run lint`: passou.
- `npm run build`: passou.

Isso confirma que o projeto gera build, mas nao confirma que os fluxos reais de igreja, convite, acesso e supervisao estejam fechados.

## Mapa de rotas

Rotas de acesso/autenticacao:

- `/login`
- `/aguardando`
- `/convite/[token]`
- `/configuracao`
- `/acesso`

Rotas principais:

- `/dashboard`
- `/celulas`
- `/pessoas`
- `/pessoas/[id]`
- `/presenca`
- `/checkin`
- `/checkin/[code]`
- `/agenda`
- `/cuidados`
- `/oracao`
- `/biblioteca`
- `/videos`
- `/notificacoes`
- `/supervisao`
- `/gestao`
- `/convites`
- `/atividades`
- `/relatorios`
- `/relatorios/novo`
- `/configuracoes`
- `/meu-discipulado`
- `/instalar`
- `/mais`
- `/offline`

## Matriz esperada de acesso

Admin:

- Ve tudo.
- Configura igreja.
- Cria celulas.
- Cria convites para admin, pastor, supervisor, lider e membro.
- Define papeis.
- Atribui supervisor e lider a celulas.

Pastor:

- Ve toda a igreja.
- Acompanha supervisores, lideres, celulas, relatorios, atividades e presencas.
- Nao deveria necessariamente criar admin ou alterar permissoes estruturais.

Supervisor:

- Ve somente as celulas atribuidas a ele.
- Registra visitas/supervisao.
- Ve atividade dos lideres e membros dessas celulas.
- Presta contas ao pastor.

Lider:

- Ve somente a propria celula.
- Cadastra pessoas da propria celula.
- Marca presenca.
- Libera discipulado.
- Cria convites de membro.
- Acompanha cuidados e videos dos membros.

Membro:

- Ve somente o proprio painel.
- Assiste videos liberados.
- Confirma se vai na celula.
- Faz pedidos de oracao.
- Ve materiais permitidos.

## Problemas criticos

1. `local-store.ts` ainda usa seeds/localStorage como fonte inicial de quase tudo.

Afeta pessoas, celulas, perfis, cuidados, relatorios, supervisao, atividades, discipulado, convites, biblioteca, check-ins, rsvps e configuracoes. Em modo autenticado, isso nao pode acontecer. O modo real deve iniciar vazio/carregando e depender do Supabase.

2. O dashboard ainda usa `careTasks` direto de `data.ts`.

Arquivo: `src/app/dashboard/page.tsx`.

Isso deixa cuidados do dashboard presos nos dados seed, nao nos `follow_ups` reais do Supabase.

3. Concluir cuidado e local-only.

Arquivos: `src/app/cuidados/page.tsx` e `src/lib/local-store.ts`.

`useCompletedCare()` grava somente no aparelho. O status real em `follow_ups` nao muda para `completed`.

4. Os mapeadores escondem dados reais.

Arquivo: `src/lib/supabase/mappers.ts`.

Celulas sempre aparecem com `leaderName: "Lider"`. Pessoas sempre aparecem com `cell: "Sem celula"`, `leader: "Lider"`, progresso zero, ausencias zero e culto falso. Precisa carregar joins/RPCs ou enriquecer depois da consulta.

5. Convites ainda precisam de fechamento de fluxo.

Arquivos: `src/app/convites/page.tsx`, `src/app/convite/[token]/page.tsx`, `src/lib/supabase/invites.sql`, `src/lib/supabase/signup-profile.sql`.

O SQL tem a intencao correta, mas precisa validar na pratica:

- convite de lider/membro exige celula;
- depois de aceitar, perfil deve sair de `sem-igreja`;
- convite deve mudar para `accepted`;
- admin precisa ver status atualizado sem depender de cache/localStorage;
- se o usuario ja existe, o aceite precisa vincular o perfil existente.

6. Cadastro direto no login cria conta pendente.

Arquivo: `src/app/login/page.tsx`.

Isso e tecnicamente seguro, mas confunde a operacao. Se a regra for "todos entram por convite", a aba `Cadastrar` deve sair ou virar uma tela clara de "solicitar acesso", com aprovacao visivel ao admin.

7. Aprovacao manual de pendentes nao esta fechada.

`/gestao` lista perfis da igreja, mas um usuario pendente pode estar com `church_id = null`, entao o admin nao consegue enxergar/aprovar facilmente.

## Problemas funcionais

8. Datas de relatorio e supervisao usam formato `pt-BR`.

Arquivos:

- `src/app/relatorios/novo/page.tsx`
- `src/app/supervisao/page.tsx`

As tabelas usam `date`. O app deve enviar `YYYY-MM-DD`, preferencialmente com input `type="date"`.

9. Presenca salva registros, mas metricas derivadas nao sao recalculadas do banco.

Arquivo: `src/app/presenca/page.tsx`.

Ausencias, presenca em culto e alertas devem ser calculados por historico real de `cell_attendance` e `service_attendance`, nao por campos locais em `people`.

10. Reflexoes de video ficam so no aparelho.

Arquivo: `src/app/meu-discipulado/page.tsx`.

As respostas do membro sao salvas em `localStorage`. Falta persistir em tabela real (`video_reflections`) ou remover essa promessa da interface.

11. Visibilidade de atividades precisa ajuste.

Arquivo: `src/lib/access-control.ts`.

Admin/pastor so veem eventos com `visibility === "leadership"`. Eventos de membro/celula podem nao subir para pastor, mesmo sendo importantes para prestacao de contas.

12. `/acesso` ainda e uma tela de simulacao.

Ela aparece em `/mais` e admin pode acessar. Para producao, deve virar "Meu acesso" real ou ser removida.

13. `/configuracao` e `/configuracoes` geram confusao.

Uma e bootstrap/primeiro admin, outra e ajustes da igreja. A rota temporaria deve ser removida/guardada depois do primeiro admin; a de ajustes deve ficar clara.

## Problemas de UX/mobile

14. Sidebar desktop ainda pode ficar apertada em telas menores.

O scroll foi melhorado, mas o bloco fixo inferior ocupa espaco. Melhor separar sidebar compacta, grupos recolhiveis e botao "mais" no desktop quando necessario.

15. Algumas telas usam grids largos e cards que cortam em desktop estreito.

Exemplo visto: modal de pessoas sobreposto e conteudo cortado. Precisa revisar com viewport mobile, tablet e desktop estreito.

16. O painel do membro nao usa o mesmo shell.

`/meu-discipulado` tem layout proprio. Pode ser intencional, mas para app instalado no telefone o membro precisa de navegacao consistente, notificacoes e retorno facil.

17. Validacoes visuais ainda sao fracas.

Exemplo: convite de lider/membro sem celula selecionada deveria bloquear antes de enviar, com mensagem clara.

## Problemas de banco/processo

18. Falta uma migracao unica/consolidada.

Hoje ha varios SQLs soltos. Se rodar fora de ordem, quebra funcoes, policies ou tabelas. Para producao, precisa existir:

- `full-setup.sql`, ou
- migrations versionadas do Supabase CLI.

19. Algumas policies antigas ainda dependem de `profiles` dentro de policy.

`admin-management.sql` reduz recursao em `profiles`, mas o ideal e centralizar helpers (`current_app_role`, `current_app_church_id`, `can_manage_church`) em todas as policies.

20. Falta teste funcional por perfil.

Nao existe teste automatico validando:

- admin ve tudo;
- pastor ve toda igreja mas nao administra tudo;
- supervisor ve suas celulas;
- lider ve sua celula;
- membro ve so ele mesmo;
- convite muda perfil corretamente;
- usuario nao autenticado nao acessa nada.

## Plano unico de correcao

Fase 1 - Fundacao real de dados:

- Criar modo `demo` separado do modo `real`.
- Em modo real, remover seeds/localStorage como fallback silencioso.
- Hooks devem expor `loading`, `error`, `refresh`.
- Se Supabase falhar, mostrar erro real, nao dado fake.

Fase 2 - Convites e acesso:

- Corrigir fluxo completo de convite.
- Validar celula obrigatoria para lider/membro.
- Atualizar status do convite apos aceite.
- Remover cadastro direto ou criar tela de solicitacoes pendentes para admin aprovar.
- Criar tela de usuarios/acessos robusta em `/gestao`.

Fase 3 - Hierarquia:

- Admin cria/promeve usuarios.
- Admin atribui pastor/supervisor/lider/celula.
- Pastor ve toda a prestacao.
- Supervisor ve varias celulas atribuidas.
- Lider ve somente a propria celula.
- Membro ve somente ele.

Fase 4 - Dados derivados reais:

- Dashboard usar somente hooks reais.
- Presencas recalcularem ausencias e culto pelo banco.
- Cuidados concluirem em `follow_ups`.
- Videos/progresso/reflexoes persistirem no Supabase.
- Atividades subirem para pastor/supervisor conforme hierarquia.

Fase 5 - Mobile/UX:

- Redesenhar sidebar e header.
- Revisar telas cortadas.
- Padronizar bottom nav.
- Melhorar formularios, empty states, erros e carregamentos.
- Testar em largura de telefone real.

Fase 6 - Publicacao:

- Rodar setup consolidado no Supabase.
- Rodar health-check.
- Testar matriz de acesso com cinco usuarios reais.
- Rodar `lint` e `build`.
- So entao publicar.

## Conclusao

O app esta em uma boa base visual e estrutural, mas ainda nao esta pronto para uso real da igreja. O maior trabalho agora e consolidar dados reais, convites, permissoes e hierarquia. Depois disso, o refinamento visual/mobile fica muito mais seguro porque a experiencia passa a refletir a verdade do banco.
