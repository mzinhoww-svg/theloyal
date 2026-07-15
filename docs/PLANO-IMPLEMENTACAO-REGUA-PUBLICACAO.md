# Plano de Implementação — Régua Real de Publicação

> **Etapa de execução.** Traduz `REGUA-PUBLICACAO-DIGESTS.md` (a política) num
> plano de engenharia executável, **ancorado no diagnóstico e no backlog já
> existentes**: `ANALISE-SISTEMA.md` (mapa funcional + plano P0–P3),
> `AUDITORIA-PREDICT-FORECAST.md` / `AUDITORIA-FORENSE-PREDICT-FORECAST.md`
> (motores) e `BACKLOG-P1-RADAR-UNIFICADO.md` (Radar). Este documento **não**
> escreve código — é o mapa que o backlog segue.
>
> **Regra de preservação:** nada aqui cria segunda fonte de verdade. Reusa
> `verdictForScore`, `TL_WEIGHTS`, `VERDICTS` (`scripts/lib.mjs`), o gate canônico
> (`scripts/validate.mjs`), o registro de entidades (`content/entities`, RFC-001),
> o motor de confiança (`scripts/forecast-engine.mjs`) e o backtest do Predict v2
> (`lib/predict-engine.ts`).
>
> **Convenção:** cada tarefa traz **Arquivos**, **Mudança**, **Testes**,
> **Aceite**, **Depende de**, **Backlog existente**, **Esforço** (S ≤ meio dia ·
> M ≈ 1–2 dias · L ≈ 3–5 dias). O selo **[APROVAÇÃO HUMANA]** marca decisões suas.

---

## 0. Leitura do diagnóstico: a régua ataca o "gêmeos"

`ANALISE-SISTEMA.md` nomeia o maior risco estrutural do projeto: **subsistemas com
duas implementações paralelas** ("gêmeos") que divergem em silêncio. As 6
premissas herdadas **são** manifestações desse achado — e a régua de publicação é
o que as consolida:

| Premissa herdada | Evidência no diagnóstico committado | Item de backlog que a régua ativa |
|---|---|---|
| **2.** TL Score digitado, não calculado | Escrito inline em `/admin/campanhas`; "sem trilha de auditoria em quem alterou veredito/score" (§5) | **P2.9** (auditoria de veredito/score) → Fase 3.1 |
| **3.** Sem nota de corte madura | Produto publica o **motor fraco** (Forecast `minSamples=2`) e esconde o forte (Predict, com gate+backtest) (§4) | **P1.6** → Fases 1.2/3.3 |
| **4.** Motor que publica ≠ motor que mede | Gêmeos: `forecast.ts`↔`forecast-engine.mjs` (cópia manual sem teste); Beehiiv **CLI × MCP** no mesmo ledger; regras invioláveis **triplicadas** com `INTERNAL_RE` fraco no Pro | **P0.3, P1.4, P1.7** → Fase 0 |
| **5.** Weekly não consolida a Daily | Weekly **sem publisher**; radar puxa do `forecast.json`, não da Daily; "radar do Daily **colado à mão**" (§2, §4) | **P2.14** → Fase 2.1 |
| **6.** Comunicação promete mais que entrega | Publica o motor fraco como se fosse o forte; QA **não audita as superfícies web** (§2) | **P1.6, P2.13** → Fases 1.3/0.3 |

**Consequência de desenho:** este plano **não abre uma frente nova** — ele dá um
eixo organizador (a régua) a itens que o diagnóstico já priorizou. Fase 0 = "P1.4
+ aposentar gêmeos de gate"; Fase 1 = "P1.6 por baixo"; Fase 2 = "P2.14 + P2.9";
Fase 3 = "P1.6 pleno via Predict v2 (P2.9)".

---

## 1. Princípio arquitetural: um único motor de disposição

O diagnóstico mostra que a regra hoje está **espalhada e triplicada**
(`validate.mjs`, `render-weekly.mjs`, `pro.mjs`) e que o pipeline tem gêmeos
canônico (`scripts/` + `content/*.schema.json`) vs legado (`renderer/*` +
`*-daily.mjs`, "fora do build mas exposto no `package.json`"). O plano gira em
torno de **centralizar a régua num módulo puro** e **aposentar os gêmeos** que a
duplicam:

```
scripts/lib/disposition.mjs   (novo — coração da régua)
  computeDisposition(item, ctx) -> Disposition
  resolveTier(source, sourceUrl, entities) -> 'T1'|'T2'|'T3'|'T0'
  gateEdition(edition, ctx) -> { release, itemDispositions[], blocks[] }
```

Consome (não duplica) `assertEditorialRules` — a **fonte única de regras
invioláveis** que o backlog **P1.4** pede criar em `lib.mjs`. Todos os
consumidores — `validate.mjs`, `qa.mjs`, `beehiiv-publish.mjs`,
`render-weekly.mjs`, `pro.mjs` — chamam esse par de módulos, nunca reimplementam
a regra. É a disciplina que o Radar já segue com `forecast-engine.mjs`.

**Contrato `Disposition`:**

```js
{
  faixa: "A" | "B" | "C" | "D" | "E",
  action: "auto" | "review-light" | "review-sign" | "downgrade" | "block",
  tier: "T1" | "T2" | "T3" | "T0",
  intensidade: "nao-acao" | "acao-baixa" | "acao-media" | "acao-alta",
  downgradeTo: "monitoramento" | "nao-confirmado" | null,
  ruleHits: string[],     // regras invioláveis (via assertEditorialRules)
  integrity: string[],    // erros determinísticos (schema, vigência, cálculo)
  reasons: string[],      // por que caiu nesta faixa (auditável)
}
```

`computeDisposition` é **pura e determinística** (sem I/O) — condição para ser
testável e para o motor de acurácia reproduzi-la.

---

## 2. Fases e dependências (visão de topo)

```
Fase 0  Unificar o gate  (P1.4 + P1.7 + P3.17)   ──┐  fecha premissa 4
  0.1 assertEditorialRules — regra inviolável única │
  0.2 Motor de disposição puro                      │
  0.3 Incoerência sempre bloqueia                   │
  0.4 Um só gate de QA; aposentar o legado          ─┘
        ↓
Fase 1  Régua mínima viável  (P1.6 por baixo)     ──┐  automação por baixo
  1.1 scoreBreakdown obrigatório p/ ação            │  início da premissa 6
  1.2 Tiers de fonte sobre entities                 │
  1.3 Dispositions + rótulo monitoramento           │
  1.4 Auto-publish só faixa A                        ─┘
        ↓
Fase 2  Rastreabilidade  (P2.14 + P2.9 + P0.3)    ──┐  fecha premissa 5
  2.1 Weekly consolida Daily (rastreável)           │
  2.2 Ledger de exceções / auditoria de score       │
  2.3 Log de publicação (unifica CLI×MCP)           ─┘
        ↓
Fase 3  Score calculado + acurácia  (P1.6 pleno)  ──┐  fecha premissas 2 e 3
  3.1 Motor de cálculo do TL Score                   │
  3.2 Acurácia via backtest do Predict v2            │
  3.3 Limiares adaptativos                            ─┘  → aí a fronteira A/B sobe
```

Cada fase é entregável e reversível por conta própria. Não pular ordem.

---

## 3. Fase 0 — Unificar o gate  (backlog P1.4 · P1.7 · P3.17)

### 0.1 `assertEditorialRules` — fonte única de regra inviolável

- **Arquivos:** `scripts/lib.mjs` (nova `assertEditorialRules`), `scripts/validate.mjs`, `scripts/render-weekly.mjs`, `scripts/pro.mjs`, `tests/lib.test.mjs`.
- **Mudança:** extrair para uma função única as varreduras hoje **triplicadas**
  (emoji, urgência, `INTERNAL_RE`/CMI, disclaimer). Corrige o achado do diagnóstico
  de que o **`INTERNAL_RE` do Pro é mais fraco** — todos passam a usar o mesmo
  regex forte. É o **P1.4** literal.
- **Testes:** termo interno que hoje passa só no Pro passa a reprovar nos três produtos.
- **Aceite:** um único ponto de verdade das regras invioláveis; paridade Daily/Weekly/Pro.
- **Depende de:** nada. **Backlog:** **P1.4**. **Esforço:** M.

### 0.2 Motor de disposição puro

- **Arquivos:** `scripts/lib/disposition.mjs` (novo); `tests/disposition.test.mjs` (novo).
- **Mudança:** `computeDisposition(item, ctx)` conforme §1, consumindo
  `verdictForScore`/`VERDICTS`/`TL_WEIGHTS` e `assertEditorialRules`. Aplica a
  **matriz §9–§10** da política. `resolveTier` stub até 1.2.
- **Testes:** tabela cobrindo cada célula (`evitaria`/T1→A, `vale-agir`/T1→C, `vale-agir`/T3→D, incoerência→E, vigência vencida→E…).
- **Aceite:** 100% das células cobertas; função pura; `node --test` verde.
- **Depende de:** 0.1. **Backlog:** novo (eixo). **Esforço:** M.

### 0.3 Incoerência sempre bloqueia

- **Arquivos:** `scripts/validate.mjs` (linhas ~95–106).
- **Mudança:** score↔verdict incoerente e `scoreBreakdown` não reconciliado são
  sempre `err` — inclusive em `--lenient`. Confirmar e blindar com teste.
- **Testes:** `tests/validate-disposition.test.mjs` (novo).
- **Aceite:** incoerência reprova em qualquer modo.
- **Depende de:** nada. **Backlog:** reforça P1.4. **Esforço:** S.

### 0.4 Um só gate de QA; aposentar o legado

- **Arquivos:** `scripts/qa.mjs`, `renderer/audit.mjs`, `renderer/validate.mjs`, `scripts/*-daily.mjs`, `package.json` (scripts `daily:*`).
- **Contexto (diagnóstico):** o QA canônico é `qa.mjs` (editorial-gate do CI), mas
  **não audita as superfícies web** (§2, gap d). O `renderer/*` + `*-daily.mjs` é
  **legado, fora do build, ainda exposto** no `package.json` (§P3.17) e audita o
  modelo antigo (`deal_desk`/`veredito`).
- **Mudança:** **(1)** estender `qa.mjs` para auditar também a superfície **web**
  (é o **P2.13**), absorvendo as checagens úteis do `audit.mjs` (CPM, contraste,
  e-mail-safe, `<img>`/stock, tokens) sobre o **modelo novo**; **(2)** aposentar
  formalmente o legado (remover `daily:*` do `package.json`, marcar `renderer/*`
  como deprecated) — é o **P3.17**. Fim dos gêmeos de gate.
- **[APROVAÇÃO HUMANA]** — confirmar aposentadoria do `renderer/*`/`daily:*`
  (irreversível-ish; garantir que nada de produção depende deles primeiro).
- **Testes:** `tests/qa.test.mjs` — edição válida passa por um caminho único; CPM inconsistente e falha de web reprovam via `qa.mjs`.
- **Aceite:** `npm run qa` e `npm run beehiiv` gateiam pelo **mesmo** motor, cobrindo e-mail **e** web; zero campo validado por um e ignorado por outro.
- **Depende de:** 0.2. **Backlog:** **P2.13, P3.17**. **Esforço:** L. **Risco:** médio → teste de paridade antes/depois.

**Saída da Fase 0:** regra inviolável única, régua centralizada, incoerência sempre bloqueia, um só gate cobrindo e-mail+web, legado aposentado. Fecha a premissa 4 no lado editorial.

---

## 4. Fase 1 — Régua mínima viável  (backlog P1.6, por baixo)

### 1.1 `scoreBreakdown` obrigatório para verdicto de ação

- **Arquivos:** `scripts/lib/disposition.mjs`, `scripts/validate.mjs`, `content/edition.schema.json` (doc).
- **Mudança:** intensidade de ação sem `scoreBreakdown` completo e reconciliado →
  **rebaixa para faixa D** (`downgradeTo: "monitoramento"`). Ler sub-critérios:
  `fontes` baixo + score alto → "conteúdo forte, fonte fraca"; `vigencia` alto sem
  campo `vigencia` → integrity.
- **Testes:** `vale-agir` sem breakdown → D; com breakdown → C.
- **Aceite:** nenhum verdicto de ação sai sem os 8 critérios explícitos.
- **Depende de:** 0.2. **Backlog:** habilita P2.9. **Esforço:** S.

### 1.2 Tiers de fonte sobre o registro de entidades

- **Arquivos:** `content/entity.schema.json`, `content/entities/index.json`, `scripts/lib/disposition.mjs` (`resolveTier`), `tests/entities.test.mjs`.
- **Mudança:** estender a entidade com `sourceTier` (`T1|T2|T3`) e `domains`
  (hostnames). `resolveTier` casa host de `sourceUrl`/aliases contra o registro →
  tier; sem match → `T0` (humano). **Reusa o registro canônico (RFC-001), não cria
  arquivo de fontes.**
  ```json
  { "key": "livelo", "name": "Livelo", "type": "programa-origem",
    "aliases": ["Livelo"], "sourceTier": "T1", "domains": ["livelo.com.br"] }
  ```
- **Testes:** domínio T1 → `T1`; fórum desconhecido → `T0`; alias sem URL → tier da entidade.
- **Aceite:** todo deal recebe tier determinístico; `T0`/`T3` nunca vira ação.
- **[APROVAÇÃO HUMANA]** — validar atribuição inicial de tiers das entidades.
- **Depende de:** 0.2. **Backlog:** base para P1.6. **Esforço:** M.

### 1.3 Dispositions no gate + rótulo `monitoramento`

- **Arquivos:** `scripts/validate.mjs` (expõe dispositions), `scripts/render.mjs`/`render-web.mjs`, `renderer/tokens.mjs` (chip), `content/edition.schema.json`.
- **Mudança:** o gate devolve, por item, sua `Disposition`. Introduzir o estado de
  saída **`monitoramento`** (chip sóbrio, sem cor de ação; nunca verde de ação —
  respeita regra inviolável 8). É a face honesta da régua (ataca premissa 6).
- **[APROVAÇÃO HUMANA]** — `monitoramento` como novo verdicto no enum **vs.** flag
  de render sobre `nao-confirmado`. Recomendação: **flag de render** (evita
  migração de schema; `nao-confirmado` + `mode: "monitoramento"`).
- **Testes:** item rebaixado renderiza chip de monitoramento, sem selo de ação, conta como observação (não recomendação).
- **Aceite:** item rebaixado nunca renderiza como `vale-agir`/hero do Deal Desk.
- **Depende de:** 1.1, 1.2. **Backlog:** P1.6, P2.13. **Esforço:** M.

### 1.4 Auto-publish restrito à faixa A

- **Arquivos:** `scripts/beehiiv-publish.mjs` (gate ~166–173), `scripts/publish.mjs`.
- **Mudança:** além do QA sem erro, **todo item de ação** exige disposição
  assinada (faixa C) para `--publish`; senão vai para fila. Faixa A (não-ação)
  segue livre. Enquanto não houver assinatura (Fase 2), `--publish` de edição com
  item de ação exige `--force` consciente + confirmação humana; default `--draft`.
- **Testes:** `tests/publish-gate.test.mjs` via `--dry-run` — só não-ação: OK; `vale-agir` não assinado: bloqueia.
- **Aceite:** o erro caro (auto-publicar ação sem assinatura) é impossível pelo caminho normal.
- **Depende de:** 1.3. **Backlog:** P1.6. **Esforço:** S.

**Saída da Fase 1:** automação por baixo; ação sempre humana; fonte fraca rebaixa; `monitoramento` visível. Publica o rigor, não o motor fraco.

---

## 5. Fase 2 — Rastreabilidade  (backlog P2.14 · P2.9 · P0.3)

### 2.1 Weekly consolida a Daily (automática e rastreável)

- **Arquivos:** `scripts/render-weekly.mjs`, `content/weekly.schema.json`, `lib/editions.ts`, `tests/weekly-consolidation.test.mjs` (novo).
- **Contexto (diagnóstico §2/§4):** hoje a Weekly **não tem publisher** e o radar
  vem do `forecast.json`, não da Daily; o radar do Daily é **colado à mão**
  (**P2.14**).
- **Mudança:** o render da Weekly **lê as edições Daily do período**, monta
  `highlights`/`movements` a partir delas e **herda a disposição mais restritiva**
  de cada item. Cada linha referencia as origens (`sourceEditions: [number]`). A
  Weekly **não pode subir a régua**. Alinha com **P1.6** (exigir confiança
  `média+` no Weekly).
- **Testes:** Weekly gerada referencia origens; nenhum item menos restritivo que na Daily.
- **Aceite:** consolidação reprodutível e rastreável linha-a-origem.
- **Depende de:** 1.3. **Backlog:** **P2.14, P1.6**. **Esforço:** L.

### 2.2 Ledger de exceções + auditoria de score

- **Arquivos:** `content/exceptions-log.json` (novo, append-only), `scripts/lib/exceptions.mjs` (novo); ganchos em `/admin/campanhas` (onde veredito/TL Score são escritos).
- **Contexto (diagnóstico §5):** "sem trilha de auditoria em quem alterou
  veredito/score" (**P2.9**).
- **Mudança:** toda aprovação/rebaixe/edição de score registra `{ edição, item,
  regra, revisor, timestamp, justificativa, disposição_final }`. Regra inviolável
  **nunca** é registrável como exceção. Insumo do motor de acurácia (3.2).
- **Testes:** append não sobrescreve; exceção a regra inviolável é recusada.
- **Aceite:** toda decisão humana fora do default fica auditável.
- **Depende de:** 1.4. **Backlog:** **P2.9**. **Esforço:** M.

### 2.3 Log de publicação (unifica CLI × MCP)

- **Arquivos:** `content/beehiiv-status.json` (ledger existente), `scripts/beehiiv-publish.mjs`.
- **Contexto (diagnóstico §6 / P0.3):** publicação tem **duas trilhas** (CLI e MCP)
  no mesmo ledger; a 0028 foi publicada pelo MCP com campo `provenance` que o
  script não conhece — a idempotência pode estar cega.
- **Mudança:** **(1)** o publisher passa a **reconhecer `provenance`** e gravar a
  `Disposition` por item publicado (base da acurácia); **(2)** trilha única de
  escrita do ledger. É o **P0.3** somado ao log da régua.
- **Testes:** publicação em mock registra dispositions; ledger com `provenance` de MCP não quebra idempotência.
- **Aceite:** histórico de publicação carrega a régua aplicada e reconhece ambas as trilhas.
- **Depende de:** 1.4. **Backlog:** **P0.3**. **Esforço:** M.

**Saída da Fase 2:** Weekly rastreável, decisões auditáveis, publicação unificada e instrumentada. Fecha a premissa 5.

---

## 6. Fase 3 — Score calculado + acurácia  (backlog P1.6 pleno · P2.9)

### 3.1 Motor de cálculo do TL Score

- **Arquivos:** `scripts/lib/score.mjs` (novo), `scripts/validate.mjs`, `/admin/campanhas` (entrada por critérios), `tests/score.test.mjs` (novo).
- **Mudança:** calcular `tlScore` dos 8 critérios via `TL_WEIGHTS` (hoje digitado —
  premissa 2). A entrada editorial passa a ser os **critérios**; o score vira
  **derivado e auditável**. A assinatura humana muda de "digitar a nota" para
  "revisar os critérios" — e cada mudança grava no ledger de auditoria (3.2/P2.9).
- **Testes:** critérios conhecidos → score esperado; bate com `verdictForScore`.
- **Aceite:** nenhum `tlScore` digitado à mão passa no gate; sempre derivado.
- **Depende de:** 1.1, 2.2. **Backlog:** **P2.9**. **Esforço:** L.

### 3.2 Motor de acurácia via backtest do Predict v2

- **Arquivos:** `scripts/accuracy.mjs` (novo), `content/accuracy.json` (novo), `lib/predict-engine.ts` (reuso), `tests/accuracy.test.mjs`.
- **Contexto (diagnóstico §4):** o **Predict v2 já tem backtest walk-forward** e
  gate por amostra — é o "motor forte" hoje escondido no admin. A premissa 4 (motor
  que publica ≠ que mede) se resolve **conectando** esse backtest, não construindo
  do zero.
- **Mudança:** motor **independente do publisher** que cruza o log de publicação
  (2.3) + ledger de exceções (2.2) + backtest do Predict v2 + vigência real dos
  deals → mede quão bem a régua previu (quantos `vale-agir` se confirmaram; onde o
  humano discordou). **Não publica nada.**
- **Testes:** histórico sintético → métricas estáveis e reproduzíveis.
- **Aceite:** relatório de acurácia por superfície, read-only.
- **Depende de:** 2.2, 2.3. **Backlog:** **P1.6, P1.7**. **Esforço:** L.

### 3.3 Limiares adaptativos

- **Arquivos:** `content/ruler-config.json` (novo), `scripts/lib/disposition.mjs`.
- **Mudança:** externalizar limiares numéricos (tier mínimo por faixa, janela de
  frescor, CV de corte) para config calibrada pela acurácia (3.2). **Estrutura**
  (faixas, assimetria, piso duro) fica fixa em código; só os **números** são
  adaptativos. Só aqui a fronteira **A/B pode subir** (auto em
  `casos-especificos`/`vale-olhar` T1) — com evidência.
- **[APROVAÇÃO HUMANA]** — toda subida da fronteira A/B, embasada no relatório de acurácia.
- **Testes:** mudar config muda disposição previsivelmente; piso de `vale-agir` imutável por config.
- **Depende de:** 3.2. **Backlog:** **P1.6**. **Esforço:** M.

**Saída da Fase 3:** score auditável, acurácia medida pelo motor forte, régua que aprende sem perder o piso. Fecha premissas 2 e 3.

---

## 7. Estratégia de testes e rollout

- **Testes:** cada módulo novo tem `tests/*.test.mjs` (`node --test`, padrão do
  repo). Motor de disposição testado por **tabela da matriz**. Fase 0.4 exige
  **teste de paridade** (QA antes = depois, exceto o que muda de propósito) — e
  reforça o **teste de equivalência TS↔mjs** que o **P1.7** já pede.
- **CI:** `npm run typecheck`, `npm test`, `npm run build`, `npm run qa` verdes por fase.
- **Rollout gradual:**
  1. Motor de disposição em **shadow** (calcula e loga, não decide) por 1 ciclo — compara com a decisão editorial atual do `/admin/campanhas`.
  2. Ativa **bloqueio/rebaixe** (faixas D/E) — o lado seguro.
  3. Ativa **auto-publish de faixa A**.
  4. Só após a Fase 3, mexe na fronteira A/B.
- **Flags:** `--dry-run` já existe no publisher; usar em todo ensaio. Nenhuma ativação ao vivo sem um ciclo em shadow.

---

## 8. Marcos e o que cada um destrava

| Marco | Entrega | Destrava | Premissa | Backlog |
|---|---|---|---|---|
| **M0** | Fase 0 | Regra única; gate único e-mail+web; legado aposentado | 4 | P1.4, P2.13, P3.17 |
| **M1** | Fase 1 | Automação por baixo; ação sempre humana; `monitoramento` visível | 6 (início) | P1.6 |
| **M2** | Fase 2 | Weekly rastreável; auditoria de score; publicação unificada | 5 | P2.14, P2.9, P0.3 |
| **M3** | Fase 3 | Score calculado; acurácia via Predict v2; limiares adaptativos | 2, 3 | P1.6 pleno, P1.7 |
| **Go-live** | por superfície | Predict já apto; Daily após M1; Weekly após M2 | — | — |

O **go-live ao vivo** de cada superfície continua sendo um ato humano deliberado
(§1.5 da política), não efeito colateral do merge.

---

## 9. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Aposentar/portar gate legado quebra QA | alto | Teste de paridade (0.4) + shadow; garantir zero dependência de produção antes (P3.17) |
| `INTERNAL_RE` unificado passa a barrar texto legítimo | médio | Rodar `assertEditorialRules` em shadow sobre edições históricas antes de ativar |
| Régua conservadora demais trava volume | médio | Faixa A cobre o volume grande (não-ação); fronteira sobe com dados na Fase 3 |
| Tier de fonte mal atribuído | médio | `T0` default seguro (vai para humano); revisão humana da tabela (1.2) |
| Score calculado diverge do editorial | médio | Fase 3 em shadow; assinatura humana revisa critérios; auditoria (P2.9) |
| Idempotência cega ao MCP | alto | Reconhecer `provenance` (2.3/P0.3) antes de qualquer `--publish` ao vivo |

---

## 10. Ordem de execução (caminho crítico)

```
0.1 → 0.2 → 0.3 → 0.4        (gate único; P1.4, P2.13, P3.17)
        ↓
1.1 → 1.2 → 1.3 → 1.4        (régua viva: shadow → D/E → A; P1.6)
        ↓
2.3 → 2.1 ‖ 2.2              (2.3/P0.3 primeiro: destrava publicação segura)
        ↓
3.1 → 3.2 → 3.3              (score → acurácia via Predict v2 → adaptação)
```

**Primeira PR sugerida:** 0.1 + 0.2 + 0.3 — `assertEditorialRules` (P1.4) + motor
de disposição puro + incoerência bloqueante. Baixo risco, alto valor, totalmente
testável, sem tocar no caminho de publicação até ser plugado.

---

## 11. Decisões suas antes de começar (consolidado)

1. **[0.4]** Confirmar aposentadoria do pipeline legado (`renderer/*`, `daily:*`) — garantir zero dependência de produção (P3.17).
2. **[1.2]** Validar a atribuição inicial de `sourceTier` das entidades.
3. **[1.3]** `monitoramento` como novo verdicto no enum **ou** flag de render sobre `nao-confirmado`. → Recomendação: **flag de render**.
4. **[2.3]** Trilha única de escrita do `beehiiv-status.json` (CLI × MCP) — P0.3.
5. **[3.3]** Toda subida da fronteira A/B — decisão embasada em acurácia.

Fechadas essas, o caminho crítico da §10 é executável ponta a ponta, e cada fase
avança um item que o diagnóstico e o backlog P0–P3 já haviam priorizado.
