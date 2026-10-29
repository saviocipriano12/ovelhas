# Missao de evolucao do Ovelhas

Objetivo: evoluir o produto em modulos sequenciais. Um modulo so pode ser encerrado depois de suas verificacoes obrigatorias passarem; o modulo seguinte nao deve comecar antes disso.

## Status

| Modulo | Estado | Criterio principal |
| --- | --- | --- |
| 0. Seguranca e baseline | Concluido em 2026-10-13 | lint, 39 testes, build de 42 rotas, auditoria de producao sem vulnerabilidades e Capacitor 8.5.3 aprovados |
| 1. Banco e controle de acesso | Em validacao; aguarda espaco em disco | Docker ativo; falta concluir a instalacao local e executar as 7 migrations e os 21 testes pgTAP |
| 2. Jornadas criticas | Aguardando | testes E2E dos fluxos essenciais |
| 3. Modularizacao | Aguardando | dominios separados do store monolitico |
| 4. Offline e sincronizacao | Aguardando | operacoes idempotentes, observaveis e recuperaveis |
| 5. Experiencia principal | Aguardando | fluxos mobile revisados e validados |
| 6. Metricas e crescimento | Aguardando | funil e indicadores operacionais instrumentados |

## Modulo 0 - Seguranca e baseline

Escopo:

- atualizar dependencias com vulnerabilidades executaveis em producao;
- manter Next.js, React e Capacitor em combinacoes compativeis;
- documentar todas as variaveis de ambiente usadas pelo servidor;
- revisar autenticacao dos endpoints de Stripe, cron e suporte da plataforma;
- eliminar avisos de lint introduzidos pelas versoes atualizadas;
- registrar limitacoes conhecidas que dependem do modulo de banco;
- validar `lint`, testes, build, `npm audit --omit=dev` e `cap doctor`.

Resultado: concluido em 2026-10-13. O rate limit compartilhado foi implementado na abertura do Modulo 1; o fallback local permanece apenas para a janela de deploy anterior a nova migration. Os endpoints protegidos continuam exigindo sessao valida ou segredo de servidor.

## Ordem dos proximos modulos

### Modulo 1 - Banco e controle de acesso

- adotar migrations versionadas;
- validar instalacao em banco vazio;
- testar isolamento por igreja e por papel;
- criar rate limit compartilhado;
- documentar backup e rollback.

Progresso em 2026-10-13:

- 7 migrations versionadas passaram na verificacao de baseline e no parser PostgreSQL;
- papeis adicionais foram incorporados aos escopos de leitura e escrita sem ampliar os tipos de operacao existentes;
- rate limit compartilhado e atomico foi preparado para os endpoints sensiveis;
- 21 testes pgTAP foram preparados para duas igrejas, papeis principais, papel adicional, leitura, inclusao fora do escopo e privilegios das RPCs sensiveis; ainda nao foram executados;
- workflow `database-tests` foi preparado para executar o portao completo em Linux para mudancas de banco; ainda nao houve uma execucao verificada;
- 44 testes unitarios, lint, TypeScript, build das 42 rotas e auditoria de producao passaram;
- pendencia: `db:reset`, `db:lint` e `db:test` nao podem rodar porque o Docker Desktop reporta `HCS_E_HYPERV_NOT_INSTALLED`. O Modulo 2 permanece aguardando.
- revalidacao confirmou virtualizacao desabilitada no firmware e ausencia de PostgreSQL local. A missao fica bloqueada ate habilitar a virtualizacao e reiniciar, ou disponibilizar um ambiente Linux para executar o workflow. Retomar pelo Modulo 1 com `npm run db:check`.

Atualizacao em 2026-10-15: Docker Desktop aberto e motor Linux confirmado em execucao (Docker 28.5.1, WSL2 respondendo). O bloqueio anterior de inicializacao foi superado. A primeira execucao de `db:start` iniciou o download das imagens, mas o espaco livre no C: caiu para aproximadamente 1,1 GB; o processo foi interrompido para evitar esgotar o disco. Apos a interrupcao havia aproximadamente 2,2 GB livres. Nenhum container Supabase ficou ativo e os testes de banco ainda nao foram executados. Retomar a instalacao apos liberar espaco e depois executar os criterios de validacao do Modulo 1.

Uma segunda tentativa usou `supabase db start`, que instala somente o PostgreSQL. Mesmo essa opcao reduziu o espaco livre para aproximadamente 1 GB antes de concluir e foi interrompida. A validacao depende agora de mais espaco no C: ou outro disco disponivel para o Docker; nao repetir downloads enquanto essa condicao permanecer.

### Modulo 2 - Jornadas criticas

- adicionar testes de integracao e E2E;
- cobrir onboarding, convites, celulas, pessoas, presenca, relatorios, cuidados, discipulado, consolidacao e assinatura.

### Modulo 3 - Modularizacao

- separar tipos, repositorios, hooks e regras por dominio;
- migrar gradualmente os consumidores de `src/lib/local-store.ts`;
- manter compatibilidade durante cada extracao.

### Modulo 4 - Offline e sincronizacao

- adicionar idempotencia, retry com backoff e estados de sincronizacao;
- testar reconexao, reinicio do aplicativo e conflitos.

### Modulo 5 - Experiencia principal

- simplificar o ciclo semanal da celula;
- revisar onboarding, navegacao, acessibilidade e responsividade;
- padronizar estados de carregamento, erro, vazio e sucesso.

### Modulo 6 - Metricas e crescimento

- medir ativacao, uso semanal, relatorios, cuidados, discipulado, retencao, erros e falhas de sincronizacao;
- criar a base para campus, redes e permissoes por escopo.

