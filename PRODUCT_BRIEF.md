# Ovelhas

Ovelhas e uma plataforma de cuidado pastoral para igrejas acompanharem pessoas, celulas, presencas e discipulado em video.

Marca: Ovelhas by Savio Cipriano.

## Posicionamento

Nenhuma pessoa sem cuidado.

O app nao deve parecer apenas um sistema administrativo. A experiencia precisa ser acolhedora, bonita, rapida no celular e orientada a acao: o lider abre o painel, entende quem precisa de atencao e consegue agir em poucos segundos.

## Usuarios

- Administrador: configura igreja, usuarios, permissoes e trilhas.
- Pastor: acompanha supervisores, celulas, lideres, relatorios e alertas.
- Supervisor: monitora varias celulas e acompanha os lideres.
- Lider de celula: acompanha participantes, presencas, visitantes e cuidados.
- Lider: cuida da celula e acompanha o discipulado dos membros.
- Novo membro: assiste aos videos liberados, acompanha progresso e fala com o lider.

## MVP

1. Login e controle basico de perfis.
2. Dashboard do lider com indicadores e cuidados urgentes.
3. Cadastro de pessoas.
4. Cadastro de celulas.
5. Marcacao de presenca na celula.
6. Marcacao de presenca no culto.
7. Area de trilhas e videos de discipulado.
8. Liberacao de trilha para novo membro.
9. Progresso dos videos.
10. Botao de WhatsApp com mensagem pronta.
11. Alertas de acompanhamento.

## Base implementada

- Estrutura Next.js com rotas reais.
- Layout mobile-first com navegacao inferior.
- PWA instalavel no telefone.
- Modo offline para presenca.
- Dashboard do lider.
- Lista de pessoas.
- Perfil da pessoa.
- Marcacao de presenca.
- Check-in por QR/codigo.
- Area de videos.
- Biblioteca de materiais e certificados.
- Fila de cuidados.
- Pedidos de oracao.
- Agenda pastoral.
- Notificacoes internas inteligentes.
- Painel do novo membro.
- Configuracoes, LGPD, auditoria e exportacao.
- Componentes reutilizaveis e dados mockados centralizados.

## Regras de cuidado

- Se uma pessoa faltar 2 celulas seguidas, criar alerta para o lider.
- Se faltar 3 celulas seguidas, marcar como urgente.
- Se um novo membro nao iniciar a trilha em 7 dias, criar alerta.
- Se ficar mais de 7 dias parado no mesmo video, criar alerta.
- Se visitar a celula pela primeira vez, criar tarefa de boas-vindas.
- Se estiver sem celula ou sem lider responsavel, aparecer no dashboard.

## Telas principais

- `/dashboard`
- `/pessoas`
- `/pessoas/[id]`
- `/celulas`
- `/celulas/[id]`
- `/presenca/celula`
- `/presenca/culto`
- `/discipulado`
- `/discipulado/trilhas`
- `/cuidados`
- `/agenda`
- `/notificacoes`
- `/oracao`
- `/biblioteca`
- `/checkin`
- `/relatorios`
- `/configuracoes`
- `/meu-discipulado`

## Direcao visual

- Mobile first.
- Interface limpa e premium.
- Cards com raio pequeno, sombras leves e boa hierarquia.
- Cores acolhedoras com verde, azul, branco, dourado suave e detalhes de alerta.
- Microinteracoes em botoes, listas, barras de progresso e transicoes.
- Indicadores claros para cuidado pastoral: bem acompanhado, atencao, urgente e novo visitante.

## Proximas fases

### Fase 1

Transformar o prototipo atual em rotas reais, componentes reutilizaveis e estado persistente.

### Fase 2

Adicionar Supabase para autenticacao, banco e storage dos videos.

### Fase 3

Criar dashboards separados por perfil: administrador, pastor, supervisor, lider e membro.

### Fase 4

Implementar automacoes de cuidado pastoral, relatorios e trilhas completas.
