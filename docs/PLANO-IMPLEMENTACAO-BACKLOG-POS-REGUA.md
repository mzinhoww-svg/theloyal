# Plano de Implementação — Backlog Pós-Régua

> **Etapa de execução.** Cobre o que **sobrou** depois da régua de publicação
> (Fases 0–3, PR #74). Ancorado no diagnóstico e backlog já existentes:
> `ANALISE-SISTEMA.md` (plano mestre **P0–P3** + achado dos "gêmeos"),
> `AUDITORIA-PREDICT-FORECAST.md` e os `BACKLOG-*-RADAR.md`. Não escreve código —
> é o mapa que o backlog segue.
>
> **Regra de preservação:** reusa o que a régua já entregou — `assertEditorialRules`,
> `computeDisposition`, `scripts/lib/score.mjs`, `content/exceptions-log.json`,
> `content/entities` — e não recria fonte de verdade.
>
> **Escopo:** foco no eixo **editorial + operação + gêmeos do pipeline**. O eixo
> Radar/Forecast interno segue sendo endereçado em paralelo (PRs #73/#76); onde a
> régua toca esse eixo (publicar o motor forte), o plano marca a fronteira.
>
> **Convenção:** cada tarefa traz **Arquivos**, **Mudança**, **Testes**,
> **Aceite**, **Depende de**, **Backlog**, **Esforço** (S ≤ meio dia · M ≈ 1–2 d ·
> L ≈ 3–5 d) e **Risco**. Selo **[APROVAÇÃO HUMANA]** quando depende de você.

---

## 0. O que a régua já fechou (baseline)

Para não reabrir: a régua entregou **P1.4** (regras invioláveis únicas), **P2.13a**
(QA audita a web), e parcialmente **P0.3**, **P1.6**, **P2.9**, **P2.14**, **P3.17**.
Este plano ataca o **restante** — os itens ainda abertos do plano P0–P3 e os
follow-ups que a régua deixou documentados.

| Onda | Tema | Premissa/Backlog que fecha |
|---|---|---|
| **A** | Quick wins de integridade | P1.8, P2.13b |
| **B** | Fechar a régua no admin | P2.9, régua 1.3/3.1 |
| **C** | Publicar o motor forte | P1.6, P2.14, régua 3.2 |
| **D** | Operação e receita | P0.1, P0.2, P0.3, P3.15 |
| **E** | Robustez / gêmeos do motor de dados | P1.5, P2.10, P2.11, P2.12, P3.16, P3.17 |

Ordem recomendada: **A → B → C** (fecham as premissas do produto editorial);
**D** em paralelo (destrava operação/receita); **E** conforme capacidade.

---

## 1. Onda A — Quick wins de integridade

### A1. Corrigir a marca "The Loyalty" → "The Loyal" (P1.8)

- **Arquivos:** `scripts/render-web.mjs` (h1 linha ~71 e `<title>` ~321),
  `scripts/render-system.mjs` (comentário ~1), `scripts/taxonomy.mjs` (comentário).
- **Contexto (diagnóstico §2, gap a):** o **h1 e o `<title>` da página web** ainda
  emitem literalmente `The Loyalty Nº X` — visível ao leitor e quebra a
  consistência de marca. `renderer/audit.mjs` já **avisa**, mas o render canônico
  ainda produz o texto errado.
- **Mudança:** trocar por "The Loyal" no h1/title; elevar a checagem de
  `renderer/audit.mjs` para **bloqueante** no `qa.mjs` (web + e-mail): qualquer
  `The Loyalty\b` no HTML renderizado reprova.
- **Testes:** `tests/qa.test.mjs` (ou novo) — HTML com "The Loyalty" reprova; o
  render atual não contém mais o termo.
- **Aceite:** `npm run render && npm run qa` sem ocorrência de "The Loyalty" no
  output; gate bloqueia regressão.
- **Depende de:** nada. **Backlog:** **P1.8**. **Esforço:** S. **Risco:** baixo.

### A2. Validação de schema em runtime com `ajv` (P2.13b)

- **Arquivos:** `package.json` (dep `ajv` + `ajv-formats`), `scripts/lib/schema.mjs`
  (novo — carrega e compila os `content/*.schema.json`), `scripts/validate.mjs`,
  `scripts/render-weekly.mjs`, `scripts/pro.mjs`.
- **Contexto (diagnóstico §2, gap e):** hoje a estrutura é validada só por código
  imperativo; o `content/edition.schema.json` (e weekly/pro/forecast) **não** é
  aplicado em runtime — um campo fora do contrato passa silenciosamente.
- **Mudança:** validar cada JSON contra seu schema com `ajv` **antes** dos checks
  semânticos; erro de schema é bloqueio. Um gate, mensagens claras (path do erro).
- **Testes:** `tests/schema.test.mjs` — edição válida passa; `additionalProperties`
  inválido e tipo errado reprovam.
- **Aceite:** todas as edições/weekly/pro atuais passam; violação de schema bloqueia.
- **Depende de:** nada. **Backlog:** **P2.13b**. **Esforço:** M. **Risco:** médio
  (pode revelar campos legados fora do schema — rodar em shadow antes de bloquear).

---

## 2. Onda B — Fechar a régua no admin (premissas 2 e 3)

### B1. Trilha de auditoria de veredito/TL Score (P2.9)

- **Arquivos:** `app/admin/(panel)/campanhas/actions.ts` (onde veredito/score são
  gravados), `scripts/lib/exceptions.mjs` (reuso), tabela/loga de auditoria
  (Supabase ou `content/exceptions-log.json` para o fluxo offline).
- **Contexto (diagnóstico §5):** "sem trilha de auditoria em quem alterou
  veredito/score". A régua criou o **ledger de exceções**; falta **plugá-lo** no
  ponto de escrita do admin.
- **Mudança:** toda mudança de veredito/score registra `{ campanha, autor,
  antes→depois, timestamp, justificativa }`. Regra inviolável nunca vira exceção
  (já garantido em `exceptions.mjs`).
- **Testes:** ação de alterar score grava entrada de auditoria; leitura reflete o histórico.
- **Aceite:** nenhuma alteração de veredito/score fica sem rastro.
- **Depende de:** régua Fase 2.2. **Backlog:** **P2.9**. **Esforço:** M. **Risco:** médio (toca Server Action + persistência).

### B2. Entrada por critérios → score derivado no admin (régua 3.1)

- **Arquivos:** `app/admin/(panel)/campanhas/page.tsx` + `actions.ts`,
  `scripts/lib/score.mjs` (reuso do `computeScore`).
- **Mudança:** o editor passa a preencher os **8 critérios**; o `tlScore` vira
  **derivado e read-only** (via `computeScore`), com o veredito sugerido por
  `verdictForScore`. A assinatura humana vira "revisar critérios", não "digitar nota".
- **[APROVAÇÃO HUMANA]** — validar a UX de entrada por critérios (muda o fluxo editorial).
- **Testes:** critérios conhecidos → score/veredito esperados na UI (unit no `score.mjs` já existe; adicionar teste de integração da action).
- **Aceite:** nenhum score digitado à mão é persistido; sempre derivado + auditado (B1).
- **Depende de:** B1. **Backlog:** régua 3.1 / **P2.9**. **Esforço:** L. **Risco:** médio.

### B3. Chip visível de `monitoramento` no render (régua 1.3)

- **Arquivos:** `scripts/render.mjs`/`render-web.mjs`, `scripts/lib.mjs`
  (`VERDICTS`/token do chip), `renderer/tokens.mjs`.
- **Mudança:** quando a disposição rebaixa um item (`downgradeTo: "monitoramento"`),
  renderizar um chip próprio — cinza/azul, **sem cor de ação** (respeita regra
  inviolável 8) — em vez de reusar `nao-confirmado`. Estado já calculado pela régua.
- **Testes:** item rebaixado renderiza chip "monitoramento", nunca selo de ação.
- **Aceite:** a face pública da régua fica explícita ao leitor (ataca premissa 6).
- **Depende de:** régua Fase 1. **Backlog:** régua 1.3. **Esforço:** M. **Risco:** baixo.

---

## 3. Onda C — Publicar o motor forte (premissa 6 / P1.6)

### C1. Levar o Predict v2 ao leitor (ou endurecer o Forecast)

- **Arquivos:** `lib/forecast.ts` / `scripts/forecast-engine.mjs` (`minSamples`),
  `lib/predict-engine.ts`, `scripts/render-weekly.mjs`, `content/forecast.json`.
- **Contexto (diagnóstico §4):** o produto publica o **motor fraco** (Forecast,
  `minSamples: 2`) e esconde o **forte** (Predict v2, com gate + backtest). Premissa 6.
- **Mudança (2 opções):** **(a)** conectar o Predict v2 à geração do radar dos
  digests via a reconciliação já existente; **(b)** mínimo: subir `minSamples` e
  **exigir confiança `média+`** no Weekly. Recomendação: começar por **(b)**
  (baixo risco) e planejar **(a)**.
- **[APROVAÇÃO HUMANA]** — escolher (a) vs (b); (a) muda o motor que o leitor vê.
- **Testes:** série com <N amostras não vira linha de radar publicável; paridade mantida (`forecast-parity`).
- **Aceite:** nenhum número de motor fraco publicado como se fosse forte.
- **Depende de:** —. **Backlog:** **P1.6**. **Esforço:** M(b)/L(a). **Risco:** médio.

### C2. Integrar o backtest do Predict v2 ao motor de acurácia (régua 3.2)

- **Arquivos:** `scripts/accuracy.mjs`, `lib/predict-engine.ts` (backtest walk-forward).
- **Mudança:** o motor de acurácia (read-only, já criado) passa a cruzar o
  **backtest** do Predict v2 com o log de publicação + vigência — fechando a
  premissa 4 (motor que mede ≠ que publica, agora conectados por leitura).
- **Testes:** `tests/accuracy.test.mjs` estendido com dados de backtest sintéticos.
- **Aceite:** relatório de acurácia inclui a métrica de backtest por série.
- **Depende de:** régua 3.2, C1. **Backlog:** **P1.6/P1.7**. **Esforço:** L. **Risco:** baixo (read-only).

### C3. Automatizar o radar do Daily (P2.14 restante)

- **Arquivos:** `scripts/render.mjs`/`render-system.mjs`, `content/forecast.json`,
  contenção `validateRadarConsistency` (já existe).
- **Contexto (diagnóstico §2/§4, gap):** o radar do **Daily** ainda é "colado à
  mão"; o Weekly já injeta do `forecast.json`. A régua rastreabilizou a
  consolidação Weekly←Daily, mas o radar do Daily segue manual.
- **Mudança:** o Daily injeta o radar do `forecast.json` (fresco) como o Weekly,
  com a mesma trava de proveniência/frescor; manual só como override marcado.
- **Testes:** radar do Daily bate com o forecast automático (a contenção já valida divergência).
- **Aceite:** zero radar manual sem proveniência no Daily.
- **Depende de:** —. **Backlog:** **P2.14**. **Esforço:** M. **Risco:** médio.

---

## 4. Onda D — Operação e receita (premissa 1: pré-operação)

### D1. Confirmar envs Beehiiv na Vercel (P0.1)

- **Arquivos:** `docs/GO-LIVE.md` (checklist), `.env.example`.
- **Mudança:** documentar e verificar `BEEHIIV_API_KEY`/`BEEHIIV_PUBLICATION_ID`
  em produção (inscrição + `/edicao` dependem). Sem código; é gate de operação.
- **[APROVAÇÃO HUMANA]** — confirmar segredos na Vercel (fora do repo).
- **Aceite:** inscrição e arquivo `/edicao` funcionam ao vivo. **Backlog:** **P0.1**. **Esforço:** S.

### D2. Régua de e-mail no Beehiiv (P0.2)

- **Arquivos:** configuração no painel Beehiiv (automação) + `docs/` (runbook).
- **Mudança:** fluxo boas-vindas → D3 → D7 → convite Pro. Conteúdo próprio, sem
  urgência artificial (regras invioláveis valem também no ciclo de vida).
- **[APROVAÇÃO HUMANA]** — aprovar copy do fluxo.
- **Aceite:** novo assinante entra na automação. **Backlog:** **P0.2**. **Esforço:** M.

### D3. Trilha única de publicação CLI × MCP (P0.3 restante)

- **Arquivos:** `scripts/beehiiv-publish.mjs`, `content/beehiiv-status.json`.
- **Contexto:** a régua fez o publisher **reconhecer/preservar** `provenance`;
  falta **definir a trilha única** de escrita do ledger (ou o script tratar
  plenamente o que o MCP publicou), fechando a idempotência cega.
- **Mudança:** normalizar o schema do ledger e a idempotência entre as duas trilhas.
- **Testes:** ledger com registro de origem MCP não é re-disparado pelo CLI.
- **Aceite:** um mesmo conteúdo nunca é disparado duas vezes, venha de onde vier.
- **Depende de:** régua 2.3. **Backlog:** **P0.3**. **Esforço:** M. **Risco:** médio.

### D4. Pro pago (P3.15)

- **Arquivos:** `app/pro/*`, gateway de pagamento, waitlist segmentada.
- **Mudança:** preço, checkout, abrir beta a partir da waitlist. Fora do escopo
  editorial; entra quando a operação (D1/D2) estiver de pé.
- **[APROVAÇÃO HUMANA]** — decisão de preço/gateway. **Backlog:** **P3.15**. **Esforço:** L.

---

## 5. Onda E — Robustez e gêmeos do motor de dados

Estes são os "gêmeos" que o diagnóstico marca como o **maior risco estrutural**
fora do editorial. Não bloqueiam a operação, mas eliminam divergência silenciosa.

| # | Item | Arquivos | Backlog | Esforço |
|---|---|---|---|---|
| E1 | Unificar o coletor na Gen-2 headless; migrar `pro:vpm` p/ ler `shopping_*`; reduzir Gen-1 | `scripts/collect/*` vs `scripts/shopping/*`, `scripts/pro-vpm.mjs` | **P1.5** | L |
| E2 | Login/sessão nos adapters headless (pontos exigem auth — bloqueio real da coleta ao vivo) | `scripts/shopping/adapters.mjs` | **P2.11** | L |
| E3 | Remover hardcodes: URL/anon Supabase → env obrigatória; branch de dispatch | `lib/admin-db.ts:8`, `lib/admin.ts:8`, workflows | **P2.10** | S |
| E4 | Paginação server-side no admin; expor UI para `/admin/sku` | `app/admin/(panel)/*` | **P2.12** | M |
| E5 | Ampliar cobertura do Radar (categorias além de áudio) p/ as bandas fecharem | `content/sku-basket.json`, adapters | **P3.16** | M |
| E6 | Aposentar fisicamente o legado `renderer/*` (a régua já tirou `daily:*`) | `renderer/*`, `app/daily/preview`, `tests/taxonomy` | **P3.17** | M |

**Nota E6:** `renderer/*` ainda é referenciado por `app/daily/preview/page.tsx` e
`tests/taxonomy.test.mjs` (importa `renderer/tokens.mjs` e o schema legado). Remover
exige migrar essas duas dependências primeiro — não é deleção pura.

---

## 6. Sequência recomendada e critérios de aceite globais

```
A1 → A2                 (integridade; A1 é quick win visível)
  ↓
B1 → B2 ‖ B3            (fecha premissas 2/3; B3 paralelizável)
  ↓
C1 → C2 ‖ C3           (publica o motor forte; premissa 6)
  ↓
D1 → D2 → D3 ‖ D4      (operação/receita; premissa 1)
  ↓
E1..E6                  (gêmeos; conforme capacidade)
```

- **CI verde por item:** `npm run typecheck && npm test && npm run validate &&
  npm run render && npm run qa && npm run build`.
- **Cada mudança de comportamento** roda primeiro em shadow/aviso; só depois bloqueia.
- **Regras invioláveis** valem em toda superfície nova (usar `assertEditorialRules`).

## 7. Recomendação de primeira PR

**A1 + A2** — corrigir "The Loyalty" (quick win, visível ao leitor) e adicionar
validação `ajv` (blinda o contrato). Baixo risco, alto valor, totalmente testável,
sem tocar em admin/operação. Fecha dois itens do plano mestre (P1.8, P2.13b) e
prepara o terreno para as Ondas B–C.

## 8. Decisões suas (consolidado)

1. **[C1]** Predict v2 ao leitor **(a)** ou endurecer o Forecast **(b)**. → Rec.: começar por (b).
2. **[B2]** UX da entrada por critérios no admin.
3. **[D1/D2]** Confirmar segredos Beehiiv e aprovar a copy do fluxo de e-mail.
4. **[D4]** Preço/gateway do Pro pago.
5. **[E6]** Confirmar migração das dependências antes de deletar `renderer/*`.
