# Product Design Review — Radar Preditivo de Campanhas (The Loyal)

> **Etapa de desenho de produto.** Nenhum código, banco, migration, dado,
> backfill, snapshot de produção, Digest ou Beehiiv foi alterado. **Nada é
> removido.** Trabalha sobre o estado atual do **PR #54** (Fases **C0** e **C0.2**
> concluídas e validadas — tratadas como **patrimônio obrigatório**).
>
> **Fontes lidas:** `AUDITORIA-PREDICT-FORECAST.md`,
> `AUDITORIA-FORENSE-PREDICT-FORECAST.md`, `RECONCILIACAO-AUDITORIAS-RADAR.md`,
> `RECONCILIACAO-FASE-C0.md`, `ARQUITETURA-PRODUTO-RADAR-PREDITIVO.md`,
> `IMPLEMENTACAO-FASE-C0-RADAR.md`, `docs/auditoria/*`,
> `docs/architecture/adr/ADR-RADAR-001..010`, e o código do PR #54.

---

## Tese central

A fundação técnica está pronta e é boa; o produto ainda não existe porque a
capacidade calculada não vira decisão nem valor. Quatro fatos verificados no
código sustentam todo o review:

1. **O Predict é invisível ao leitor.** Curva P7–P180, janela central,
   distribuição de bônus, backtest walk-forward e `explanation` existem só em
   `/admin/predict`; não há `predict.json` nem integração com Digest; os
   `predict_snapshots` são write-only.
2. **A saída ao leitor descarta a honestidade que o C0 calculou.** `radarItems`
   emite só `{label, confidence, window, basis, bonus}` — `warnings`,
   `maxIntervalDays`, "quantas campanhas sustentam", motivo e faixa são jogados
   fora antes do Weekly.
3. **Três telas mostram três recortes do mesmo motor** (Forecast, Predict,
   metade da Observabilidade), podendo divergir para a mesma rota, sem decisão
   editorial entre eles.
4. **O artefato que o leitor recebe é pré-C0 e no limite do stale**
   (`forecast.json` com 119 linhas, sem campos do C0, 3 overrides ignorados).

Logo, o redesign é sobretudo de **integração e experiência**: ativar, integrar e
dar voz ao que já existe, sob fonte única e com o risco à vista — sem motor novo
e sem segunda fonte de verdade. A cura da causa raiz (dedup e correção de data no
banco) é estrutural e depende das decisões dos ADRs `proposed`.

---

## 0. Regra-mãe deste review

**Tudo que foi construído até aqui é preservado e passa a ser *usado*.** Este
review não reescreve motores nem cria uma segunda fonte de verdade — ele
**converte capacidade técnica já existente em experiência** para editor,
analista, operador e leitor. Qualquer proposta que toque algo existente traz a
justificativa de 7 pontos do briefing §2; na ausência dela, **preserva-se o atual**.

Fonte única de verdade já estabelecida (`RECONCILIACAO-FASE-C0.md`, não duplicar):
`campaign-quality` → `buildForecast`/`buildPredict` (só `eligibleRows`) →
`editorialGate` → `forecast-freshness` → `radar-consistency`.

---

## 1. Diagnóstico — respostas diretas (§5 do briefing)

**O que já funciona bem?**
- Contenção de dado corrompido **na origem** (C0.2): `assessCampaignQuality` roda
  dentro dos motores; `suspect_year` e `probable_duplicate` saem antes das ondas.
  O 943d não vira intervalo nem "2029" (provado em `tests/campaign-quality.test.mjs`).
- Gate editorial separado do cálculo (C0): amostra ≥5, intervalo extremo, horizonte.
- Frescor + dataset completo; anti-contradição Daily×Weekly; paridade TS↔MJS;
  motivos de exclusão visíveis (`QualityPanel`).

**O que ainda é técnico demais?** CV, hazard, `waves`, `stdev`, backtest numérico
aparecem na primeira dobra do admin; `em-formacao`/`insuficiente` são jargões.

**O que o editor não consegue decidir?** "Vale publicar / o que mudou / prioridade
/ risco" — os sinais existem (`editorialEligible`, `warnings`, freshness, `.quality`)
mas **dispersos**, nunca reunidos numa decisão.

**O que o analista não consegue explicar?** Forecast × Predict **lado a lado** e a
**divergência**; e o backtest de qualquer série (hoje só a de maior histórico tem
`DetailCard`).

**O que o operador não consegue monitorar?** Um **painel de saúde único** (base
completa? fresca? quantas bloqueadas por classe? quais perderam amostra? o que
revisar?). Os campos existem (`datasetComplete`, `assessForecastArtifact`,
`.quality.counters`, `requiresHumanReview`), sem tela que os junte.

**O que o leitor não consegue entender?** A **chance** (P30/P60/P90) — porque o
Predict, que a calcula, **não chega ao leitor**; ele só recebe a janela do Forecast.

**Capacidades subutilizadas:** Predict inteiro; `.quality.excluded` e contadores;
`requiresReprocessing`/`requiresHumanReview`; snapshots do predict (gravados e não
lidos); `dataMaxObservedAt`; `editorialBlockReason`.

**Telas — manter / consolidar / mover:**
- **Manter (motor vivo):** `campanhas`, `noticias`, `backfill`, `digests`,
  `observability`.
- **Consolidar:** `/admin/forecast` + `/admin/predict` → **um "Radar"** com abas
  *Séries · Qualidade · Motores · Configuração* (nenhuma capacidade removida — as
  duas telas viram duas visões do mesmo produto).
- **Sair da visão principal → detalhe do analista:** CV, desvio, hazard, `waves`,
  backtest numérico.
- **Alertas antes do resultado:** `datasetComplete=false`, `stale`, exclusões novas
  e divergência de motores aparecem **acima** de qualquer número.

---

## 2. Inventário de capacidades → uso no produto final (§5 tabela)

Cobre **toda** a C0 e C0.2. Nada é substituído; tudo é **promovido a uso**.

| Capacidade existente | Onde existe hoje | Valor atual | Problema de uso | Como deve ser usada no produto final |
|---|---|---|---|---|
| Forecast (recorrência) | `lib/forecast.ts`+`forecast-engine.mjs` | janela por cadência | tratado como "produto" | **motor interno**: baseline/fallback do resultado canônico |
| Predict v2 (hazard/backtest) | `lib/predict-engine.ts` | P7–P180, bônus, backtest | **não chega ao leitor** | **motor interno canônico** quando `ready`; alimenta chance/janela do leitor |
| Validação temporal | `evaluateTemporalPlausibility` | bloqueia data fabricada | só tabela | **fila de revisão** + selo "dado verificado" |
| `suspect_year` / bloqueio crítico | `campaign-quality` | contém 943d | invisível ao editor | **badge "excluída — data suspeita"** + razão |
| Duplicidade provável | `detectProbableDuplicates` | não forma intervalo falso | só no painel | **agrupar "mesma campanha (2 registros)"** com link |
| Exclusão antes das ondas | `assessCampaignQuality`→motores | séries limpas | resultado implícito | **contador "N excluídas"** + "por quê" na série |
| Normalização defensiva | `normProgram` (injetado) | alias único nos 2 motores | ok | preservar; base do rótulo de programa |
| Dataset completo (paginação) | `fetchAllRows`/`datasetComplete` | fim do corte 2.000 | flag técnica | **semáforo "base completa"**; bloqueia publicação |
| Gate editorial | `editorialGate` | frágil não publica | motivo em texto | **estado da série** (`publicável/em formação/bloqueada`)+motivo |
| `minEditorialWaves`=5 | `DEFAULT_FORECAST_CONFIG` | evita janela de 1 intervalo | só default | exposto na Config, com histórico |
| Warnings de intervalo longo | `editorialGate.warnings` | 943d visível | lista de texto | **selo de anomalia** + "revisar" |
| Bloqueio por horizonte | `editorialGate` | sem "2029" ao leitor | ok | preservar; "previsão distante → revisão" |
| Frescor do artefato | `forecast-freshness` | Weekly sem stale | só no render | **carimbo "atualizado há X"** + bloqueio |
| Anti-contradição Daily×Weekly | `radar-consistency`+QA | evita divergência | só no QA | **gate de publicação** visível ao editor |
| Paridade TS↔MJS | `forecast-parity.test.mjs` | motor = pipeline | invisível | garantia de "reprodutível" |
| Observabilidade | `/admin/observability` | derivados do ledger | copy corrigida | base do **painel do operador** |
| Motivos de exclusão | `.quality.excluded[].reason` | rastreabilidade | tabela | "não entrou porque…" em toda série |
| Painel de qualidade | `QualityPanel.tsx` | resumo+excluídas | 2 páginas | **aba Qualidade** do Radar |
| `.quality.counters` | resultado dos motores | totais | StatCards soltos | **cabeçalho de saúde** |
| Snapshots forecast/predict | tabelas | histórico | predict grava e não lê | **histórico de série** (evolução de confiança) |
| `requiresReprocessing/HumanReview` | `TemporalResult` | sinaliza dado ruim | não vira trabalho | **fila de revisão** do operador |
| `dataMaxObservedAt`/`generatedAt` | artefato/loaders | frescor | pouco visível | carimbo em toda superfície |
| Testes / schemas / ADRs | `tests/*`, schemas, ADR-001..010 | fundação | — | base das decisões §8 |

### 2.1 Substituições propostas — justificativa de 7 pontos (briefing §2)

Nenhuma capacidade é removida. Há **duas** substituições, ambas de
**superfície/saída**, nenhuma de motor. O briefing exige, para cada uma, os 7
pontos abaixo.

**Substituição A — saída `radarItems` empobrecida → payload enriquecido (contrato §18 da arquitetura).**
1. **O que muda:** a *forma da saída* de `radarItems` (`{label, confidence,
   window, basis, bonus}`), não a função nem o gate.
2. **Por que é insuficiente hoje:** descarta `warnings`, `maxIntervalDays`,
   "quantas campanhas sustentam", motivo e faixa — a honestidade que o C0
   calcula; o leitor recebe data precisa sem ressalva.
3. **Ganho ao usuário:** faixa honesta, chance, "N campanhas", "o que pode
   invalidar" e frescor — decisão calibrada em vez de falsa precisão.
4. **Risco:** payload maior; o schema do digest precisa acomodar campos novos.
5. **Compatibilidade:** campos **aditivos**; os atuais permanecem; consumidores
   antigos ignoram o excedente; `radar-consistency` segue válido.
6. **Migração sem perder histórico:** edições legadas seguem com radar manual
   marcado "análise editorial" (comportamento atual do QA); nada é reescrito.
7. **Sem segunda fonte:** o payload sai do **mesmo** resultado reconciliado — é
   enriquecimento do contrato único, não um artefato paralelo.

**Substituição B — três telas de motor → um "Radar" com abas (uma fonte).**
1. **O que muda:** a *navegação* (`/admin/forecast` + `/admin/predict` +
   metade da Observabilidade como destinos separados), não as visualizações nem
   os dados.
2. **Por que é insuficiente hoje:** três recortes do mesmo motor podem divergir
   para a mesma rota; o editor não tem lugar de decisão; o operador, de saúde.
3. **Ganho ao usuário:** uma fonte, três profundidades; divergência eliminada
   por construção; a decisão editorial passa a existir.
4. **Risco:** re-arranjo de IA pode confundir quem já conhece as telas.
5. **Compatibilidade:** tabelas, `QualityPanel`, `DetailCard`, timeline e
   overrides são **reaproveitados** como componentes das abas.
6. **Migração sem perder histórico:** rotas atuais redirecionam para as abas;
   snapshots e overrides existentes seguem válidos.
7. **Sem segunda fonte:** as abas leem o **mesmo** resultado reconciliado — o
   oposto de criar nova fonte.

Levar o **Predict ao leitor** (P6 do roadmap) usa a mesma saída da Substituição A
via reconciliação (ADR-008): não cria `predict.json` paralelo, apenas escolhe
qual resultado — Predict `ready` ou Forecast fallback — preenche o contrato único.

---

## 3. Visão do produto (§6)

- **Nome:** **Radar Preditivo de Campanhas** (interno: "Radar"). Forecast/Predict
  = motores internos, nunca nomeados ao leitor.
- **Propósito:** transformar o histórico já limpo (C0.2) em decisão editorial e de
  leitura, sem expor a máquina.
- **Promessa:** todo número mostrado passou por qualidade de dado + gate editorial +
  frescor; toda ausência de número tem motivo.
- **Público:** leitor (Digest), editor (curadoria), analista (explicação), operador
  (saúde).
- **Decisões suportadas:** publicar/segurar; destacar; revisar; transferir/esperar.
- **Limites:** não é dashboard estatístico para o leitor; não é segunda base de
  dados; não gera data exata; não é garantia; não substitui o **TL Score** (veredito
  de deal) — Radar é **projeção**.
- **Linguagem:** leitor em pt-BR comum ("chance estimada", "janela", "bônus mais
  recorrente", "atualizado"); analista em termos técnicos, a um clique.
- **Diferencial:** o único radar que **mostra o que excluiu e por quê**.
- **Relação com os produtos:** **Daily** = alerta curto (7–30 d), poucas séries,
  só aprovado; **Weekly** = radar 30–90 d + "o que mudou na semana"; **Pro** =
  histórico, curva de probabilidade, backtest, comparação entre programas. Todos
  leem **o mesmo** resultado aprovado (nunca stale, nunca contraditório).
- **O que é × o que não é:** É uma camada de **inteligência** sobre o ledger. **Não
  é** um novo coletor, nem um motor a mais, nem um recomendador de compra.

---

## 4. Arquitetura de produto — por estágio (§7)

Cada estágio já tem **dono no código**, exceto *Reconciliação* e *Aprovação/
snapshot canônico* (as duas peças estruturais faltantes — ADR-008/006, `proposed`).

| Estágio | Objetivo | Entrada | Saída | Dono no código (hoje) | Estados | Falha contida por |
|---|---|---|---|---|---|---|
| Dados observados | ler o ledger inteiro | `campaigns` | linhas + `datasetComplete` | `fetchAllRows` / `forecast.mjs` paginado | completo/parcial | dataset incompleto → bloqueia |
| Qualidade e elegibilidade | tirar dado corrompido | linhas | `eligibleRows` + `.quality` | `assessCampaignQuality` (C0.2) | valid/…/suspect_year/dup | exclusão explícita + motivo |
| Séries válidas | montar ondas/intervalos | `eligibleRows` | séries por rota/cluster | `buildForecast`/`buildPredict` (só elegíveis) | ondas colapsadas | nunca forma intervalo de duplicata |
| Forecast | baseline por cadência | séries | janela + confiança + gate | `editorialGate` | publicável/em formação/bloqueada | amostra/intervalo/horizonte |
| Predict | quando/quanto | séries | P7–P180, bônus, backtest, readiness | `buildPredict` | ready/…/insuficiente | gate de amostra + backtest |
| **Reconciliação** | 1 resultado por série | Forecast+Predict | resultado canônico + motor escolhido | **NOVO (ADR-008)** | predict/forecast-fallback/não-confirmado | divergência > limiar → revisão |
| Inteligência editorial | "o que mudou / risco / prioridade" | resultado + `.quality` + freshness | fila do editor | deriva de campos existentes (P1–P3) | novo/mudou/estável | gate + frescor antes do número |
| **Aprovação** | gate humano + carimbo | resultado | snapshot aprovado | **NOVO (ADR-006)** | draft→approved→published→expired | freshness + `datasetComplete` + consistency |
| Daily/Weekly/Pro/Admin | distribuir | snapshot aprovado | bloco Radar | render + `radar-consistency` | fresco/stale | nunca stale/contraditório |

Regra de ouro (briefing §4.15): **os bloqueios de C0/C0.2 têm precedência sobre
qualquer score** em todos os estágios.

---

## 5. Experiência por papel (com wireframes textuais)

### 5.1 Editor — "vale publicar?"
Deriva de `editorialEligible`, `warnings`, `.quality`, freshness, `datasetComplete`.

```
┌ RADAR · Fila de decisão ───────────────────────── base ✅ completa · atualizado há 2h ┐
│  [!] 2 séries com exclusões novas nesta rodada · [!] Predict×Forecast divergem em 1   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  Programa/Rota        Estado        O que mudou         Risco            Ação          │
│  Latam Pass (→)       publicável    +1 onda, conf ↑     —                Aprovar ▸     │
│  Livelo → Smiles      publicável    janela adiantou 3d  —                Aprovar ▸     │
│  Azul (→)             em formação   1 onda excluída     amostra caiu     Revisar ▸     │
│  Livelo→ConnectMiles  bloqueada     —                   data suspeita    Ver motivo ▸  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
Nunca deixa aprovar com base incompleta, artefato stale ou contradição Daily×Weekly
— o gate aparece **acima** da fila.

### 5.2 Analista — "por que este número?"
Reusa `QualityPanel`, `.quality.excluded`, backtest, snapshots.

```
┌ Série: → ConnectMiles ───────────────────────────────────────────────┐
│ Motor selecionado: Predict (fallback Forecast) · reprodutível ✓       │
│ FORECAST            │ PREDICT              │ Divergência              │
│  janela 9–23 ago    │ P30 41% P60 58% P90… │ centro +6d (aceitável)   │
│  conf. média        │ conf. média · bt 62% │ mesmo eligibleRows       │
├───────────────────────────────────────────────────────────────────────┤
│ Formaram a série (3 ondas): 22/02 · 20/09 · 12/07 …                   │
│ EXCLUÍDAS (1): livelo-…-2023-12-12 · data 2023-12-12 · prov 2026-07-12 │
│   Δ 943d · flags: suspect_year · duplicidade PROVÁVEL de …-2026-07-12  │
│   → não entrou: suspect_year+probable_duplicate                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 5.3 Operador — "a base está sã?"
Reusa `datasetComplete`, `forecast-freshness`, `.quality.counters`, observability.

```
┌ SAÚDE DO RADAR ──────────────────────────────────────────────────────┐
│ Base: ✅ completa (2.5k linhas)   Artefato: ✅ fresco (2h / <24h)      │
│ Elegíveis 348 · Bloqueadas: temporal 6 · duplicidade 3 · placeholder 1│
│ Séries que perderam amostra após exclusão: 2                          │
├ FILA DE REVISÃO ─────────────────────────────────────────────────────┤
│  campanha            motivo          ação sugerida                    │
│  livelo-…-2023-12-12 suspect_year    reprocessar notícia              │
│  esfera-…-na         permanente      classificar como oferta ativa    │
└───────────────────────────────────────────────────────────────────────┘
```

### 5.4 Leitor — "o que pode acontecer?"
Reusa Predict (P30/P60/P90), Forecast (janela), bônus, freshness. **Sem** CV/hazard/waves.

```
Radar · ConnectMiles
Chance estimada de nova campanha em 30 dias: 41%.
Janela mais provável: 9 a 23 de agosto.
Bônus mais recorrente: 40%.
Confiança: média (poucos ciclos observados). Atualizado hoje.
```
Sem número → texto honesto: **"Não confirmado"**, **"histórico insuficiente"**,
**"base incompleta"**, **"desatualizado"** (estados já existentes).

---

## 6. Princípios de interface (§4)

1. Motores nunca nomeados ao leitor; "motor selecionado" só no admin.
2–4. Suspeito/duplicado/`datasetComplete=false`/`stale` **não** viram previsão nem
publicação (já garantido por C0/C0.2).
5. Toda série bloqueada mostra **motivo** (`editorialBlockReason`/`reason`).
6. **Duas confianças rotuladas:** *confiança do modelo* (amostra+CV+backtest, já
calculada) × *confiança editorial* (aprovação humana). Leitor vê síntese; analista, as duas.
7. **Frescor sempre visível**; **rastreável sempre**; **exclusão sempre explícita**.
8. **Bloqueios C0/C0.2 têm precedência sobre score.**

---

## 7. Métricas (derivam de campos já existentes)

- **Dado:** % elegíveis; % excluídas por classe; Δ elegíveis pós-C0.2 (`.quality.counters`).
- **Modelo:** window-hit + erro mediano (backtest); concordância Forecast×Predict.
- **Operação:** % `publicável`; artefatos stale em uso (=0); tamanho/tempo da fila de revisão.
- **Editorial:** previsões no Daily/Weekly; "Não confirmado" exibidos; contradições barradas.
- **Leitor:** engajamento do bloco Radar (Beehiiv); depois `prediction_outcome` (ADR-006) para acerto real.

---

## 8. Roadmap (reusa 100% do patrimônio)

| Fase | Entrega (experiência) | Reusa | Estrutural? | Justificativa vs preservação |
|---|---|---|---|---|
| **P1 — Unificar a visão** | aba "Radar" (Séries/Qualidade/Motores/Config) + semáforo de saúde + motivos de exclusão por série | tudo C0/C0.2 | não | só reorganiza UI; nenhuma regra tocada |
| **P2 — Analista** | Forecast×Predict lado a lado + divergência; backtest por série | `.quality`, backtest, snapshots | não | expõe dado já calculado |
| **P3 — Operador** | painel de saúde + fila de revisão | `datasetComplete`, freshness, `.quality` | não | flags viram trabalho |
| **P4 — Reconciliação** | 1 resultado canônico (Predict>Forecast sobre série válida) | motores + gates | **sim** (ADR-008) | leva o motor melhor ao leitor |
| **P5 — Snapshot canônico + aprovação** | gate + carimbo + `usages` | freshness, consistency | **sim** (ADR-006) | fim do stale/contradição de forma persistida |
| **P6 — Leitor via Predict** | chance/janela/bônus no Daily/Weekly | Predict + reconciliação | depende P4/P5 | valor pronto ao leitor |
| **P7 — Acurácia real** | `prediction_outcome` | snapshots | **sim** (ADR-006) | mede o produto, não só o modelo |

P1–P3 = puro produto (sem migration). P4–P7 dependem das decisões §9 e das ADRs `proposed`.

---

## 9. Decisões que dependem do usuário (antes de P4+)

Já mapeadas nos ADRs `proposed`:
1. **Motor canônico = Predict quando `ready`; Forecast baseline/fallback** (ADR-008).
2. **Divergência máxima aceitável** entre motores (ADR-008).
3. **Gates de amostra por finalidade** (5/6/10) (ADR-004).
4. **Chave de série** e rota×cluster (ADR-003) — sem "consertar" 943d por pooling.
5. **Snapshot canônico + expiração + `usages`** e TTL de frescor (ADR-006).
6. **Persistir identidade/dedup** (ADR-009) e **limiares temporais** (ADR-010).
7. **Exposição de probabilidade ao leitor** e política de "Não confirmado".
8. **Nível de automação editorial** (semi vs auto pós-calibração).

Adiar mantém o Predict invisível ao leitor e a fila de revisão manual.

---

## 10. Não-metas desta etapa

Não implementar código; não reescrever motores; não criar segunda fonte de verdade;
não persistir identidade/dedup/snapshot; não expor estatística ao leitor; não remover
capacidade C0/C0.2. Este documento **desenha**; a implementação segue P1→P7 com
aprovação das decisões §9.

---

## Anexo — pergunta do papel → campo que já responde

| Pergunta | Campo/rotina existente |
|---|---|
| Editor: "risco de publicar frágil?" | `editorialEligible`+`editorialBlockReason`+`warnings`+freshness+`datasetComplete` |
| Editor: "o que mudou?" | diff de `.quality.counters`/confiança entre snapshots |
| Analista: "quais excluídas e por quê?" | `.quality.excluded[]` (reason, temporal.flags, duplicate) |
| Analista: "onde divergem?" | `buildForecast` × `buildPredict` sobre o **mesmo** `eligibleRows` |
| Analista: "reprodutível?" | paridade TS↔MJS + (futuro) `dataset_hash` do snapshot canônico |
| Operador: "base sã?" | `datasetComplete`, `assessForecastArtifact.status`, `.quality.counters` |
| Operador: "o que revisar?" | `requiresHumanReview`/`requiresReprocessing` |
| Leitor: "chance/janela/bônus?" | Predict `probabilities`/`windowStart..End`, `typicalPercent` |
| Leitor: "atualizado?" | `generatedAt`/`dataMaxObservedAt` + `assessForecastArtifact` |
