# Controle de acesso do Ovelhas

Este documento descreve a hierarquia da igreja no Ovelhas e a forma como o app deve proteger informacoes.

## Hierarquia

```txt
Administrador
Pastor
Supervisor
Lider
Membro
```

## Administrador

O administrador ve tudo e configura tudo:

- igrejas;
- usuarios;
- pastores;
- supervisores;
- lideres;
- celulas;
- membros;
- trilhas;
- videos;
- relatorios;
- permissoes.

## Pastor

O pastor ve a visao geral liberada para ele pelo administrador:

- supervisores;
- celulas;
- lideres;
- membros;
- presencas;
- discipulado;
- cuidados pastorais;
- relatorios gerais.

## Supervisor

O supervisor acompanha varias celulas.

Ele ve:

- celulas vinculadas a ele;
- lideres dessas celulas;
- membros dessas celulas;
- presencas;
- andamento do discipulado;
- alertas de cuidado;
- relatorios para prestar contas ao pastor.
- visitas semanais ou acompanhamentos feitos nas celulas.

O supervisor nao e o cuidador direto no app. Ele monitora, orienta e acompanha os lideres.

## Prestacao de contas

O app deve registrar movimentos importantes em `activity_events`:

- lider enviou relatorio;
- lider cadastrou pessoa;
- lider marcou presenca;
- supervisor visitou ou acompanhou celula;
- membro iniciou ou concluiu video;
- cuidado pastoral foi concluido.

Visibilidade:

- administrador e pastor veem eventos de lideranca da igreja;
- supervisor ve eventos das celulas que supervisiona;
- lider ve eventos da propria celula;
- membro ve somente eventos proprios marcados como visiveis para membro.

## Gestao de responsabilidades

O app tambem precisa apontar lacunas:

- celula sem supervisor;
- celula sem lider;
- pessoa sem lider responsavel;
- celula sem supervisao recente;
- lider que nao envia relatorio;
- membro que nao avanca no discipulado.

Essas lacunas aparecem em `/gestao` para ajudar administrador, pastor e supervisor a tomarem decisao.

Administrador e pastor tambem podem usar `/gestao` para:

- mudar o tipo de acesso de um usuario;
- definir qual supervisor acompanha uma celula;
- definir qual lider cuida de uma celula;
- registrar a alteracao no feed de atividades.

## Lider

O lider cuida da propria celula e tambem e o responsavel pelo discipulado das pessoas daquela celula.

Ele ve:

- membros da propria celula;
- visitantes que cadastrou;
- presenca da propria celula;
- presenca no culto das pessoas da celula;
- trilhas e videos liberados para seus membros;
- progresso do discipulado;
- cuidados e alertas das pessoas sob responsabilidade dele;
- WhatsApp dos membros para acompanhamento rapido.

Ele nao ve pessoas de outras celulas.

## Membro

O membro ve apenas:

- o proprio perfil;
- sua celula;
- seu lider;
- videos liberados;
- progresso no discipulado;
- confirmacao de presenca da semana;
- biblioteca liberada para membros;
- pedidos de oracao permitidos;
- notificacoes proprias;
- historico permitido;
- botao para falar com o lider.

O membro nao ve lista de pessoas, relatorios, notas privadas ou informacoes de outros membros.

## Entrada de usuarios

O fluxo correto e por convite:

1. Administrador cria pastor, supervisor e lider.
2. Lider ou administrador cria convite para membro.
3. A pessoa abre o link, cria/entra na conta e aceita o convite.
4. O convite vincula igreja, papel e celula.

Conta criada diretamente em `/login` fica pendente:

- sem `church_id`;
- sem pessoa vinculada;
- sem acesso a rotas operacionais;
- redirecionada para `/aguardando`.

Essa conta so passa a ver o app quando aceita um convite ou quando o administrador vincula corretamente.

## Campos de acesso usados no prototipo

Em `people`:

- `church_id`
- `cell_id`
- `created_by_user_id`
- `leader_user_id`
- `person_user_id`

Em `users`:

- `id`
- `role`
- `church_id`
- `cell_ids`
- `person_id`

## Regras conceituais

```txt
admin:
  person.church_id = user.church_id

pastor:
  person.church_id = user.church_id

supervisor:
  person.church_id = user.church_id
  AND person.cell_id esta nas celulas supervisionadas pelo user

leader:
  person.leader_user_id = user.id
  OR person.created_by_user_id = user.id
  OR person.cell_id esta nas celulas lideradas pelo user

member:
  person.person_user_id = user.id
```

## RLS conceitual para Supabase

Exemplo para leitura de pessoas:

```sql
create policy "people_select_by_responsibility"
on people
for select
using (
  exists (
    select 1
    from users u
    where u.id = auth.uid()
    and (
      (u.role in ('admin', 'pastor') and u.church_id = people.church_id)
      or (
        u.role = 'supervisor'
        and u.church_id = people.church_id
        and exists (
          select 1
          from supervisor_cells sc
          where sc.supervisor_id = u.id
          and sc.cell_id = people.cell_id
        )
      )
      or (
        u.role = 'leader'
        and (
          people.leader_user_id = u.id
          or people.created_by_user_id = u.id
          or exists (
            select 1 from cells c
            where c.id = people.cell_id
            and c.leader_id = u.id
          )
        )
      )
      or (u.role = 'member' and people.person_user_id = u.id)
    )
  )
);
```

## Notas pastorais

As observacoes precisam ter visibilidade:

- `leadership_private`: administrador, pastor, supervisor e lider responsavel;
- `leader_private`: lider responsavel, supervisor, pastor e administrador;
- `member_visible`: pode aparecer para o membro.

O membro nunca deve acessar notas privadas da lideranca.

## Estado atual no app

O app ja tem:

- usuarios mockados e perfis reais vindos de `profiles` no Supabase;
- bloqueio de rota por perfil;
- menu filtrado por perfil;
- contas sem convite tratadas como pendentes;
- seletor de perfil restrito ao fluxo administrativo/demonstração;
- papeis alinhados a administrador, pastor, supervisor, lider e membro;
- filtragem por perfil em dashboard, pessoas, presenca, videos, cuidados e perfil;
- criacao local de pessoas com `createdByUserId` e `leaderUserId`;
- login real via Supabase Auth;
- RLS inicial para pessoas, celulas, relatorios, supervisao, atividades e gestao;
- tela `/gestao` para promover usuarios e atribuir supervisor/lider por celula.
