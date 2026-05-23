# Roadmap tecnico do Ovelhas

## Estado atual

O app ja tem uma base mobile-first com:

- PWA instalavel.
- Base nativa com Capacitor para Android/iOS.
- Central `/instalar` para PWA, compartilhamento e permissao de notificacoes.
- Modo offline com fila local para presenca.
- Navegacao inferior para uso no telefone.
- Rotas reais para dashboard, pessoas, perfil, presencas, videos, cuidados e meu discipulado.
- Rotas de celulas, relatorios, agenda, notificacoes, oracao, biblioteca, check-in e menu Mais para mobile.
- Componentes reutilizaveis.
- Dados mockados centralizados.
- Design responsivo com foco em lider de celula usando no celular.

## Proxima fase: produto funcional com dados reais

1. Adicionar Supabase.
2. Criar autenticacao.
3. Criar perfis: administrador, pastor, supervisor, lider e membro.
4. Criar tabelas reais no PostgreSQL.
5. Substituir dados mockados de `src/lib/data.ts` por consultas reais.
6. Proteger rotas por perfil.
7. Implementar RLS conforme `ACCESS_CONTROL.md`.

## Modelo de dados inicial

- churches
- users
- cells
- people
- cell_meetings
- cell_attendance
- church_services
- service_attendance
- discipleship_tracks
- discipleship_videos
- person_track_access
- video_progress
- follow_ups
- pastoral_notes
- timeline_events
- prayer_requests
- pastoral_reminders
- library_materials
- certificates
- checkins
- church_settings

## Fluxos essenciais

- Lider cadastra pessoa.
- Lider vincula pessoa a celula.
- Lider marca presenca da celula.
- Lider marca presenca no culto.
- Pastor cria trilha de videos.
- Lider libera trilha para novo membro.
- Novo membro assiste videos em `/meu-discipulado`.
- Sistema registra progresso.
- Sistema gera cuidados automaticos.
- Lider abre WhatsApp com mensagem pronta.
- Membro registra pedido de oracao.
- Lider gera QR de check-in.
- Pastor/admin cadastra materiais e emite certificados.
- Admin/pastor exporta backup e acompanha auditoria.
- Lider ou membro instala o app e ativa avisos do aparelho.
- Membro assiste video embutido, salva progresso e registra reflexao.

## Automacoes

- Faltou 2 celulas: cuidado de prioridade alta.
- Faltou 3 celulas: cuidado urgente.
- Visitante novo: tarefa de boas-vindas.
- Novo membro sem trilha iniciada em 7 dias: alerta.
- Discipulo parado no mesmo video por 7 dias: alerta.
- Pessoa sem celula: alerta para pastor ou secretaria.
- Pessoa sem lider responsavel: alerta para supervisor ou pastor.

## Qualidade mobile

- Todas as acoes importantes devem caber no polegar.
- Botoes principais devem ter pelo menos 44px de altura.
- Presenca deve ser marcada em menos de 30 segundos.
- WhatsApp deve estar sempre a um toque de distancia.
- O app deve funcionar bem como PWA instalado no Android e iOS.
- O empacotamento nativo deve manter a mesma experiencia mobile do PWA.
