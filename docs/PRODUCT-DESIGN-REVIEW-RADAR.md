# Product Design Review — Radar Preditivo de Campanhas (The Loyal)

> **Etapa de desenho de produto.** Nenhum código, banco, migration, dado,
> backfill, snapshot de produção, Digest ou Beehiiv foi alterado. Nada é removido.
> Trabalha sobre o estado atual do **PR #54** (Fases **C0** e **C0.2** concluídas e
> validadas — tratadas aqui como **patrimônio obrigatório**).
>
> **Fontes lidas:** `AUDITORIA-PREDICT-FORECAST.md`,
> `AUDITORIA-FORENSE-PREDICT-FORECAST.md`, `RECONCILIACAO-AUDITORIAS-RADAR.md`,
> `RECONCILIACAO-FASE-C0.md`, `ARQUITETURA-PRODUTO-RADAR-PREDITIVO.md`,
> `IMPLEMENTACAO-FASE-C0-RADAR.md`, `docs/auditoria/*`,
> `docs/architecture/adr/ADR-RADAR-001..010`, e o código do PR #54.

---

## 0. Regra-mãe deste review

**Tudo que foi construído até aqui é preservado e passa a ser *usado*.** Este
review não propõe reescrever motores nem criar uma segunda fonte de verdade: ele
**converte capacidade técnica já existente em experiência** para editor, analista,
operador e leitor. Onde uma proposta tocar algo existente, ela vem com a
justificativa de 7 pontos exigida (§2 do briefing). Na ausência dessa
justificativa, **preserva-se o comportamento atual**.

Fonte única de verdade já estabelecida (não duplicar):
`campaign-quality` → `buildForecast`/`buildPredict` (só `eligibleRows`) →
`editorialGate` → `forecast-freshness` → `radar-consistency` (`RECONCILIACAO-FASE-C0.md`).

---

## 1. Diagnóstico do produto atual

### O que já funciona bem (patrimônio)
- **Contenção de dado corrompido na origem** (C0.2): `assessCampaignQuality` roda
  **dentro** dos motores; datas suspeitas (`suspect_year`) e duplicatas prováveis
  saem **antes** de formar ondas. O 943d não vira intervalo nem previsão de 2029.
- **Gate editorial separado do cálculo** (C0): amostra ≥5 ondas, intervalo extremo,
  horizonte — série frágil calcula mas **não publica**, com motivo.
- **Frescor + dataset completo** (C0): Weekly não usa `forecast.json` stale;
  paginação completa (`fetchAllRows`) elimina o corte silencioso de 2.000.
- **Anti-contradição Daily×Weekly** (C0): `radar-consistency` no QA.
- **Rastreabilidade e honestidade**: `QualityPanel` mostra excluídas + motivo;
  paridade TS↔MJS; testes ponta-a-ponta do 943d.

### O que ainda é técnico demais / subutilizado
- **Predict é o motor mais defensável (probabilidades P7–P180, backtest,
  censura) e não chega a ninguém além do admin.** Todo o valor de "chance em 30
  dias" está construído e invisível ao leitor.
- **Dois produtos, dois vocabulários** (`em-formacao` vs `insuficiente`, `minSamples`
  2 vs 3): o operador não sabe que são o mesmo produto visto por dois ângulos.
- **`.quality` (contadores, excluídas, duplicidades)** existe no resultado dos dois
  motores, mas só aparece como tabela; não vira **decisão** ("o que revisar hoje").
- **Confiança do modelo × confiança editorial** ainda não são campos distintos na
  experiência — o leitor vê "alta/média/baixa" sem saber de qual se trata.
- **`requiresReprocessing`/`requiresHumanReview`/`editorialBlockReason`** são
  produzidos mas não viram **fila de trabalho**.

### Lacunas por papel
| Papel | Não consegue hoje |
|---|---|
| Editor | Ver "vale publicar? o que mudou? qual a prioridade? há risco de publicar frágil?" num só lugar — os sinais existem, dispersos. |
| Analista | Ver Forecast × Predict **lado a lado** com a divergência explicada; abrir o backtest de qualquer série (só a top tem `DetailCard`). |
| Operador | Um painel de **saúde** único (dataset completo? fresco? quantas bloqueadas? quais perderam qualidade? o que revisar?). |
| Leitor | Receber a previsão do **Predict** em linguagem simples (chance/janela/bônus) — hoje só recebe a janela do Forecast. |

### Telas: manter / consolidar / mover
- **Manter (motor vivo):** `/admin/observability` (derivados do ledger), toda a
  operação de `campanhas`, `noticias`, `backfill`, `digests`.
- **Consolidar:** `/admin/forecast` + `/admin/predict` → **um "Radar"** com abas
  *Séries · Qualidade · Motores (comparação) · Configuração*. Nenhuma capacidade é
  removida — as duas telas viram **duas visões** do mesmo produto.
- **Mover da visão principal para "detalhe/analista":** CV, desvio, hazard bruto,
  `waves`, `stdev`, backtest numérico — ficam a um clique, nunca na primeira dobra.
- **Alertas antes do resultado:** dataset incompleto, artefato stale, série com
  exclusões novas e divergência entre motores devem aparecer **acima** de qualquer
  número previsto.

---

## 2. Inventário de capacidades → uso no produto final

Cobre **toda** a C0 e C0.2. Nada aqui é substituído; tudo é **promovido a uso**.

| Capacidade existente | Onde existe hoje | Valor atual | Problema de uso | Como deve ser usada no produto final |
|---|---|---|---|---|
| Forecast (recorrência) | `lib/forecast.ts`+`forecast-engine.mjs` | janela por cadência | tratado como "produto" próprio | **motor interno**: baseline/fallback do resultado canônico |
| Predict v2 (hazard/backtest) | `lib/predict-engine.ts` | P7–P180, bônus, backtest | **não chega ao leitor** | **motor interno canônico** quando `ready`; alimenta chance/janela do leitor |
| Validação temporal | `evaluateTemporalPlausibility` | bloqueia data fabricada | só tabela no admin | vira **fila de revisão** + selo "dado verificado" na série |
| `suspect_year` / bloqueio crítico | `campaign-quality` | contém 943d | invisível ao editor | **badge "excluída — data suspeita"** + razão no detalhe |
| Duplicidade provável | `detectProbableDuplicates` | não forma intervalo falso | só no `QualityPanel` | **agrupamento "mesma campanha (2 registros)"** com link entre eles |
| Exclusão antes das ondas | `assessCampaignQuality`→motores | séries limpas | resultado só implícito | **contador "N excluídas"** na série + "por quê" |
| Normalização defensiva | `normProgram` (injetado) | alias único nos 2 motores | ok | preservar; base do rótulo de programa ao leitor |
| Dataset completo (paginação) | `fetchAllRows`/`datasetComplete` | fim do corte 2.000 | flag técnica | **semáforo "base completa"** no topo; bloqueia publicação |
| Gate editorial (amostra/intervalo/horizonte) | `editorialGate` | frágil não publica | motivo em texto | **estado da série** (`publicável / em formação / bloqueada`) + motivo |
| `minEditorialWaves`=5 | `DEFAULT_FORECAST_CONFIG` | evita janela de 1 intervalo | só default | exposto na Configuração (com histórico de alteração) |
| Warnings de intervalo longo | `editorialGate`/`warnings` | 943d visível | lista de texto | **selo de anomalia** na série + "revisar" |
| Bloqueio por horizonte | `editorialGate` | sem "2029" ao leitor | ok | preservar; "previsão distante → revisão" |
| Frescor do artefato | `forecast-freshness` | Weekly sem stale | só no render | **carimbo "atualizado há X"** em toda superfície + bloqueio |
| Anti-contradição Daily×Weekly | `radar-consistency`+QA | evita divergência | só no QA | **gate de publicação** visível no editor |
| Paridade TS↔MJS | `forecast-parity.test.mjs` | motor = pipeline | invisível | preservar como garantia; citar em "reprodutível" |
| Observabilidade | `/admin/observability` | derivados do ledger | copy corrigida | base do **painel do operador** |
| Motivos de exclusão | `.quality.excluded[].reason` | rastreabilidade | tabela | **tooltip/coluna** "não entrou porque…" em toda série |
| Painel de qualidade | `QualityPanel.tsx` | resumo + excluídas | 2 páginas | **aba Qualidade** do Radar unificado |
| `.quality.counters` | resultado dos motores | totais elegíveis/bloqueadas | StatCards soltos | **cabeçalho de saúde** do produto |
| Snapshots (forecast/predict) | `forecast_snapshots`/`predict_snapshots` | histórico | predict grava e não lê | **histórico de série** (evolução da confiança) |
| Testes / contratos / ADRs | `tests/*`, schemas, ADR-001..010 | fundação | — | base das decisões pendentes (§8) |

---

## 3. Visão do produto

**Radar Preditivo de Campanhas** — uma inteligência editorial que responde, com
honestidade calibrada, *quando* uma campanha de transferência tende a abrir e
*qual bônus* esperar, e que **se recusa a prever sobre dado corrompido**.

- **Propósito:** transformar o histórico do ledger (já limpo por C0.2) em decisão
  editorial e de leitura, sem expor a máquina.
- **Promessa:** todo número mostrado passou por qualidade de dado, gate editorial e
  frescor; toda ausência de número tem motivo.
- **Público:** leitor (Digest), editor (curadoria), analista (explicação), operador
  (saúde).
- **Decisões que suporta:** publicar/segurar; destacar; revisar; transferir/esperar.
- **É:** um produto único com Forecast e Predict como **motores internos**, uma
  fonte de verdade, e camadas de qualidade/gate/frescor **obrigatórias** antes de
  qualquer saída.
- **Não é:** um dashboard de estatística para o leitor; uma segunda base de dados;
  um gerador de datas exatas; um selo de garantia. Não substitui o TL Score
  (veredito de deal) — Radar é **projeção**, não recomendação de compra.
- **Linguagem:** leitor em português comum ("chance estimada", "janela", "bônus
  mais recorrente", "atualizado"); analista em termos técnicos, a um clique.
- **Diferencial:** é o único radar do mercado que **mostra o que excluiu e por quê**.

---

## 4. Arquitetura de produto (mapeada ao que já existe)

```
Dados observados (campaigns, fetchAllRows → datasetComplete)
  → Qualidade e elegibilidade   [C0.2: assessCampaignQuality: temporal + duplicidade + placeholder]
  → Séries válidas               [buildForecast/buildPredict só com eligibleRows]
  → Forecast (baseline)          [editorialGate: amostra/intervalo/horizonte]
  → Predict (canônico quando ready) [P7–P180, bônus, backtest]
  → Reconciliação                [NOVO — ADR-008; Predict>Forecast só sobre série válida]
  → Inteligência editorial       [o que mudou / prioridade / risco — deriva de .quality + gates]
  → Aprovação                    [gate humano; freshness + datasetComplete + radar-consistency]
  → Daily / Weekly / Pro / Admin [1 snapshot aprovado; nunca stale, nunca contraditório]
```

Cada seta **já tem dono técnico**, exceto **Reconciliação** e **Aprovação/snapshot
canônico**, que são as duas peças estruturais faltantes (ADR-008/006, `proposed`).
Todo o resto é ligar o que existe à experiência.

---

## 5. Experiência por papel

Cada papel recebe **uma tela-âncora** que reusa os campos já produzidos.

### Editor — "vale publicar?"
Deriva de `editorialEligible`, `warnings`, `.quality`, `freshness`, `datasetComplete`.
- **Fila de decisão** (não uma tabela de números): cada série candidata mostra
  **estado** (`publicável / em formação / bloqueada`), **o que mudou** (nova onda,
  perda de amostra por exclusão, confiança que subiu/desceu), **risco** (frescor,
  divergência de motores, exclusões recentes) e **ação** (aprovar/segurar/revisar).
- Nunca deixa publicar com `datasetComplete=false`, artefato stale ou contradição
  Daily×Weekly — o gate aparece **antes** do número.

### Analista — "por que este número?"
Reusa `QualityPanel`, `.quality.excluded`, backtest, `series` snapshots.
- **Detalhe de série** com: campanhas que formaram × **excluídas (motivo, data
  candidata, proveniência, Δ dias, flags, duplicidade, relacionadas)**; Forecast
  **e** Predict **lado a lado** com a divergência rotulada; backtest de **qualquer**
  série (não só a top); reprodutibilidade (dataset/hash quando o snapshot canônico
  existir).

### Operador — "a base está sã?"
Reusa `datasetComplete`, `forecast-freshness`, `.quality.counters`, observability.
- **Painel de saúde**: base completa? artefato fresco? quantas séries elegíveis ×
  bloqueadas (temporal/duplicidade/placeholder/amostra)? quais **perderam amostra**
  após exclusão? **fila de revisão** (`requiresHumanReview`/`requiresReprocessing`).

### Leitor — "o que pode acontecer?"
Reusa Predict (P30/P60/P90), Forecast (janela), `typicalPercent`/bônus, freshness.
- Bloco na Digest em **linguagem comum**, sem CV/hazard/waves:
  *"Chance estimada de nova campanha em 30 dias: 42%. Janela provável: 8–24 ago.
  Bônus mais recorrente: 20–30%. Confiança: média. Atualizado hoje."*
- Sem número → texto honesto: **"Não confirmado"**, **"histórico insuficiente"**,
  **"base incompleta"** ou **"desatualizado"** (estados já existentes).

---

## 6. Princípios de interface (derivados do briefing §4)

1. Motores nunca nomeados ao leitor; ao operador aparecem como "motor selecionado".
2. Dado temporalmente suspeito **nunca** aparece como previsão (já garantido por C0.2).
3. Duplicidade provável nunca gera intervalo silencioso (já garantido).
4. `datasetComplete=false` e `stale` bloqueiam publicação (já garantido).
5. Toda série bloqueada mostra **motivo** (`editorialBlockReason`/`reason`).
6. **Duas confianças distintas e rotuladas:** *confiança do modelo* (amostra+CV+
   backtest, já calculada) × *confiança editorial* (aprovação humana). O leitor vê
   uma síntese; o analista vê as duas.
7. **Frescor sempre visível** ("atualizado há X"); **rastreável sempre** (quais
   campanhas, quais excluídas); **exclusão sempre explícita**.
8. **Bloqueios da C0/C0.2 têm precedência sobre qualquer score** (regra dura).

---

## 7. Métricas do produto (todas derivam de campos já existentes)

- **Dado:** % elegíveis, % excluídas por classe (temporal/duplicidade/placeholder/
  sem data), Δ elegíveis após C0.2 (via `.quality.counters`).
- **Modelo:** window-hit e erro mediano do backtest; concordância Forecast×Predict.
- **Operação:** % séries `publicável`; artefatos stale em uso (deve ser 0); fila de
  revisão (tamanho e tempo).
- **Editorial:** previsões usadas no Daily/Weekly; "Não confirmado" exibidos;
  contradições barradas pelo QA.
- **Leitor:** engajamento do bloco Radar (Beehiiv), depois `prediction_outcome`
  (fase estrutural — ADR-006) para acerto real.

---

## 8. Roadmap de produto (reusa 100% do patrimônio)

| Fase | Entrega (experiência) | Reusa | Novo (estrutural?) | Justificativa vs preservação |
|---|---|---|---|---|
| **P1 — Unificar a visão** | aba única "Radar" (Séries/Qualidade/Motores/Config), semáforo de saúde no topo, motivos de exclusão em cada série | tudo de C0/C0.2 | não | só reorganiza UI; nenhuma regra tocada |
| **P2 — Analista** | Forecast×Predict lado a lado + divergência rotulada; backtest por série; detalhe reusa `QualityPanel` | `.quality`, backtest, snapshots | não | expõe dado já calculado |
| **P3 — Operador** | painel de saúde + **fila de revisão** (`requiresHumanReview`/`Reprocessing`) | `datasetComplete`, freshness, `.quality` | não | transforma flags em trabalho |
| **P4 — Reconciliação (estrutural)** | 1 resultado canônico por série (Predict>Forecast sobre série válida) | motores + gates | **sim** (ADR-008) | Predict ao leitor exige regra; sem isso, o motor melhor fica invisível |
| **P5 — Snapshot canônico + aprovação** | gate editorial, carimbo de frescor, `prediction_snapshot_usages` | freshness, consistency | **sim** (ADR-006) | fim do stale/contradição de forma persistida |
| **P6 — Leitor via Predict** | chance/janela/bônus em linguagem comum no Daily/Weekly, do snapshot aprovado | Predict + reconciliação | depende de P4/P5 | leva o valor já pronto ao leitor |
| **P7 — Acurácia real** | `prediction_outcome` (previsto × realizado) | snapshots | **sim** (ADR-006) | mede o produto, não só o modelo |

P1–P3 são **puro produto** (nenhuma migration). P4–P7 dependem das decisões
pendentes (§9) e das ADRs `proposed` — não iniciar sem aprovação.

---

## 9. Decisões que dependem do usuário (antes de P4+)

Todas já mapeadas nos ADRs `proposed` (não decidir por engenharia):
1. **Motor canônico = Predict quando `ready`; Forecast = baseline/fallback** (ADR-008).
2. **Divergência máxima aceitável** entre motores antes de exigir revisão (ADR-008).
3. **Gates de amostra por finalidade** (5/6/10) definitivos (ADR-004).
4. **Chave de série** e política rota×cluster (ADR-003) — sem "consertar" 943d por pooling.
5. **Snapshot canônico + expiração + `usages`** e o TTL de frescor (ADR-006).
6. **Persistir identidade/dedup** (ADR-009) e **limiares temporais** (ADR-010).
7. **Exposição de probabilidade ao leitor** (P30/60/90) e política de "Não confirmado".
8. **Nível de automação editorial** (semi vs auto pós-calibração).

Impacto de adiar: o Predict (motor mais forte) permanece invisível ao leitor e a
fila de revisão permanece manual.

---

## 10. Não-metas desta etapa

Não implementar código; não reescrever motores; não criar segunda fonte de verdade;
não persistir identidade/dedup/snapshot; não expor estatística ao leitor; não
remover nenhuma capacidade C0/C0.2. Este documento **desenha**; a implementação
segue as fases P1→P7 com aprovação das decisões §9.

---

## Anexo — mapeamento decisão-de-usuário → campo já existente

| Pergunta do papel | Campo/rotina que já responde |
|---|---|
| Editor: "há risco de publicar frágil?" | `editorialEligible`+`editorialBlockReason`+`warnings`+`freshness`+`datasetComplete` |
| Editor: "o que mudou?" | diff de `.quality.counters` e confiança entre snapshots |
| Analista: "quais excluídas e por quê?" | `.quality.excluded[]` (reason, temporal.flags, duplicate) |
| Analista: "onde divergem?" | `buildForecast` × `buildPredict` sobre o **mesmo** `eligibleRows` |
| Operador: "base sã?" | `datasetComplete`, `assessForecastArtifact.status`, `.quality.counters` |
| Operador: "o que revisar?" | `requiresHumanReview` / `requiresReprocessing` (temporal) |
| Leitor: "chance/janela/bônus?" | Predict `probabilities`/`windowStart..End`, `typicalPercent` |
| Leitor: "atualizado?" | `generatedAt`/`dataMaxObservedAt` + `assessForecastArtifact` |
