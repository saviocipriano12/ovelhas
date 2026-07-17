# Roadmap tecnico do Ovelhas

## Estado atual

O Ovelhas ja funciona como base real de operacao pastoral com:

- autenticacao e perfis por acesso;
- rotas protegidas por papel;
- Supabase como backend principal;
- PWA instalavel com suporte nativo via Capacitor;
- presenca de celula, consolidacao, check-in, relatorios e supervisao;
- discipulado com trilhas, progresso e reflexoes;
- pedidos de oracao, agenda pastoral, comunicados e biblioteca;
- fallback local para varios modulos e fila offline para presenca.

## O que entra agora

### 1. Lider sem sobrecarga no culto

- remover o controle de presenca no culto do fluxo semanal do lider;
- manter o lider focado em preparar, reunir e fechar a celula;
- deixar a consolidacao como responsavel pelo culto e seus numeros.

### 2. Central do membro v1

- historico pessoal da caminhada;
- leitura clara de proximo passo;
- agenda pessoal da celula e do discipulado;
- pedidos de cuidado mais claros;
- mural segmentado com avisos relevantes;
- perfil com melhor contexto e validacao.

### 3. Sincronizacao mais confiavel

- expandir fila offline e retry para relatorios, supervisao, agenda e registros sensiveis;
- deixar claro para o usuario quando algo salvou localmente e quando sincronizou;
- reduzir risco de dados ficarem presos so no aparelho.

### 4. Base tecnica mais modular

- separar a camada atual por dominio;
- reduzir o acoplamento de `src/lib/local-store.ts`;
- preparar o projeto para crescer sem perder legibilidade.

## Backlog estrategico

### Permissoes e estrutura

- permitir multiplos papeis por pessoa conforme escopo;
- separar permissoes como `ver`, `editar`, `aprovar`, `exportar`, `convidar` e `auditar`;
- evoluir de papel global para responsabilidade por escopo;
- suportar igreja, campus, rede, supervisao, celula e ministerio.

Exemplo futuro:

- uma pessoa pode ser lider em uma celula;
- membro em outra frente;
- comunicacao apenas para avisos de um campus.

### Estrutura da igreja

- campus ou unidade;
- rede ou setor;
- supervisao;
- ministerios;
- familias;
- jornada pastoral mais completa por etapa.

### Central do membro v2

- historico completo de presenca em celula e culto;
- acompanhamento de batismo, integracao, curso e servico;
- pedidos estruturados de visita, aconselhamento, ajuda e oracao;
- confirmacao de presenca em eventos alem da celula;
- perfil familiar com mais contexto pastoral.

### Governanca e auditoria

- trilha de auditoria seria por criacao, edicao e exclusao;
- registro de antes e depois;
- informacao de sincronizado ou pendente;
- leitura operacional para admin, pastor e supervisao.

### Inteligencia e analytics

- saude da celula;
- crescimento e retencao;
- visitantes convertidos em membros;
- membros evoluindo para lideranca;
- gargalos de consolidacao e discipulado.

## Direcao de arquitetura

Estrutura desejada para as proximas fases:

- `domain`
- `permissions`
- `repositories`
- `offline-sync`
- `ui-hooks`

Divisao sugerida dos stores:

- `people-store`
- `reports-store`
- `supervision-store`
- `discipleship-store`
- `settings-store`
- `notifications-store`

## Qualidade esperada

- acoes principais resolvidas com poucos toques no celular;
- feedback claro de salvamento e sincronizacao;
- cada perfil vendo apenas o que deve ver;
- fluxo do lider simples;
- fluxo do membro acolhedor;
- crescimento de produto sem depender de remendos.
