# Desenho — Aprovação de 1 clique + Fila de revisão (M2.7 / A4)

> Peça para **ratificação do operador** antes de virar a peça final do M2.7.
> Nada aqui envia sozinho: auto-publish permanece OFF por construção.

## Princípio

A aprovação é a **única fronteira humana** entre o rascunho pronto e o envio.
Tudo antes dela é automático e determinístico (montagem → verificação → gate →
render → rascunho). A aprovação é **uma ação**, tomada depois de o operador ver
duas coisas: a **prévia do rascunho** e a **fila de revisão**.

## Fluxo end-to-end do operador

```
06:30 BRT (quando a cadência estiver ligada)
        │
        ▼
[runner daily.mjs, automático]
  1. monta a edição do dia
  2. verifica (pré-superfície D-060/D-061) → separa a FILA DE REVISÃO
  3. gate único (schema→dado→editorial); vermelho ABORTA aqui (nunca vira rascunho)
  4. render Beehiiv + e-mail
  5. cria/atualiza o RASCUNHO no Beehiiv (draft-only, idempotente por data)
     + escreve out/daily/NNNN-revisao.md (a fila, legível)
        │
        ▼
[operador, quando quiser — não há relógio correndo]
  A. abre a prévia do rascunho no Beehiiv (link do draft)
  B. lê out/daily/NNNN-revisao.md — os itens flagados, com motivo e fonte
        │
        ├─ algo errado? → corrige o dado/edição, o runner regera (idempotente)
        │
        ▼
  C. APROVA — 1 ação:
     dispara o workflow "Beehiiv Publish" com action=publish (ou schedule)
     e confirm="PUBLICAR"  ← a única ação que autoriza o envio
        │
        ▼
[envio real pelo Beehiiv]  — só acontece por causa de C.
```

## As duas peças concretas (já implementadas)

1. **Fila de revisão** — `out/daily/NNNN-revisao.md`, escrita pelo runner a cada
   execução. Lista cada item flagado pela pré-superfície com o flag, o motivo e
   os dados-chave (tipo, %, TL, estado). É a lista que o operador confere ANTES
   de aprovar — os flags nunca some do fluxo (D-060), aparecem aqui.
   Fonte estruturada equivalente: `campanha_versoes` com `evento =
   'flag_pre_superficie'` (gravada no ingest, A1) — mesma informação, para o M3
   consumir numa página.

2. **Aprovação de 1 clique** — reusa o workflow **`Beehiiv Publish (manual)`** que
   já existe (`.github/workflows/beehiiv.yml`): `workflow_dispatch`, campo
   `confirm` que exige digitar `PUBLICAR` para `publish`/`schedule`. Essa é a
   ação única. Alternativa equivalente para quem prefere: o botão de envio na
   própria UI do Beehiiv sobre o rascunho.

## Mecanismo de 1 clique — recomendação

**Recomendo o workflow `Beehiiv Publish` como o "1 clique" oficial**, porque:
- já existe, é idempotente (ledger), e nunca envia sem o `confirm: PUBLICAR`;
- deixa rastro (quem disparou, quando) no histórico do Actions;
- separa limpo o **rascunho automático** (daily.yml, draft-only) do **envio
  humano** (beehiiv.yml, com confirmação) — dois workflows, duas
  responsabilidades, sem auto-publish possível por acidente.

A UI do Beehiiv fica como caminho manual alternativo, não o oficial (não deixa
rastro no repositório nem passa pelo ledger).

## O que falta para virar a peça final (depende da ratificação)

- **Ratificar** este fluxo (ou pedir ajuste no mecanismo de 1 clique).
- Ligar a cadência (descomentar o `schedule` em `daily.yml`) — **decisão do
  operador**, é o gatilho que inicia os 5 dias úteis.
- Opcional M3: expor a fila de revisão (`flag_pre_superficie`) numa página, em
  vez de só no arquivo `.md` — casa com o benchmark /promocoes (D-059).
