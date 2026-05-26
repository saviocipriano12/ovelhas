# Ovelhas - checklist de uso real mobile

Este checklist valida o fluxo completo antes de publicar para a igreja.

## Banco e acesso

1. Rodar `src/lib/supabase/full-setup.sql` no SQL Editor do Supabase.
2. Rodar `src/lib/supabase/health-check.sql`.
3. Entrar com o primeiro administrador.
4. Conferir se o admin acessa `Celulas`, `Pessoas`, `Gestao`, `Convites`, `Relatorios`, `Ajustes` e `Instalar`.
5. Criar uma igreja/configurar nome, cidade e mensagens em `Ajustes`.

## Hierarquia

1. Admin cria uma celula.
2. Admin gera convite de pastor.
3. Pastor entra pelo link e consegue criar celulas, convites, ver relatorios e ajustar a igreja.
4. Pastor gera convite de supervisor.
5. Pastor ou admin atribui celulas ao supervisor em `Gestao`.
6. Supervisor gera convite de lider para uma celula dele.
7. Lider entra e enxerga apenas a celula atribuida.
8. Lider gera convite de membro.
9. Membro entra e cai no painel do proprio discipulado, sem acesso administrativo.

## Celula no dia a dia

1. Membro abre no celular e confirma se vai estar na celula.
2. Lider abre `Presenca` e ve quem confirmou, quem talvez vai e quem nao vai.
3. Lider marca presenca da celula e presenca no culto.
4. Se alguem faltar duas vezes, o app cria cuidado automatico.
5. Lider abre WhatsApp pelo cuidado e marca como realizado.

## Discipulado

1. Pastor/admin cria uma trilha em `Videos`.
2. Pastor/admin adiciona videos por URL.
3. Lider libera trilha para o membro.
4. Membro assiste no `Meu discipulado`, marca progresso e responde reflexao.
5. Lider ve progresso do membro.

## Relatorios

1. Lider envia relatorio semanal da celula.
2. Supervisor ve relatorios das celulas que supervisiona.
3. Pastor ve consolidado da igreja.
4. Admin/pastor baixa o relatorio em HTML e testa salvar como PDF no celular.

## Mobile Android

1. Abrir no Chrome Android.
2. Instalar como PWA.
3. Validar login, menu inferior, header, convites, presenca, videos e relatorios.
4. Testar modo offline na tela de presenca e depois voltar internet.
5. Ativar notificacoes do aparelho se o navegador permitir.

## Mobile iOS

1. Abrir no Safari iPhone.
2. Adicionar a tela inicial.
3. Validar login, menu inferior, header e areas do membro.
4. Testar convite aberto pelo WhatsApp.
5. Testar relatorio baixado/compartilhado.

## Sinais de pronto para publicar

1. Nenhuma tela administrativa aparece para membro.
2. Supervisor nao ve celulas de outro supervisor.
3. Lider nao ve pessoas fora da sua celula.
4. Convite aceito muda para `Aceito`.
5. Presenca e confirmacao semanal aparecem para o lider.
6. Build local passa sem erro.
7. O app instalado no celular abre sem tela cortada.
