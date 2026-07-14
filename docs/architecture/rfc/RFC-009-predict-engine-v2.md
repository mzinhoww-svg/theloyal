# RFC-009 — Motor Histórico & Preditivo de Campanhas v2 (`campaign_predict_v2`)

- **Status:** Proposto
- **Data:** 2026-07-14
- **Relação com o motor atual:** NÃO substitui. O motor de intervalo atual é
  **renomeado e limpo como `forecast`** (radar rápido) e **convive** com o novo
  `predict` (motor robusto). Ver §0.
- **Escopo de 1ª entrega:** reformular o `forecast` → depois o MVP `predict` num
  programa (Fases 0 + 4 + 5)

---

## 0. Forecast × Predict — dois produtos que convivem

Hoje o naming está cruzado e confunde: o motor mora em `lib/predictions.ts` mas
produz "forecast" (`buildForecast`), a config é `forecast_*`, os scripts são
`forecast.mjs`+`predictions.mjs` e a tela é `/admin/predict`. Vamos separar em
**dois produtos distintos, com nomes consistentes, que rodam lado a lado**:

| | **Forecast** (radar rápido) | **Predict** (motor robusto) |
|---|---|---|
| O que é | recorrência de intervalo por rota `origem→destino` | motor por série com hazard + distribuição de bônus |
| Pergunta | "mais ou menos quando cai a próxima janela?" | "qual a probabilidade/janela/% da próxima, com que confiança e por quê?" |
| Custo | barato, sempre-ligado, alimenta o radar do daily/weekly | pesado, gated, backtestado, auditável |
| Gate | projeção honesta; `em-formacao` sem base | **bloqueia** quando dados insuficientes |
| Home | `/admin/forecast` | `/admin/predict` (reconstruído) |
| Código | `lib/forecast.ts` + `scripts/forecast.mjs` + `forecast_*` | `lib/predict/*` + `scripts/predict.mjs` + `predict_*` |

**Regra de convivência:** o `forecast` é o resumo rápido; o `predict` é a análise
profunda e rastreável. Onde os dois falam da mesma rota, o `predict` (quando
`ready`) é a fonte de verdade; o `forecast` nunca finge a precisão do `predict`.

### Fase A — Reformular o `forecast` (clareza, sem mudar comportamento)
Consolidar o motor atual sob um nome coeso e legível, **coexistindo**:
- `lib/predictions.ts` → **`lib/forecast.ts`** (mantém `buildForecast`/`radarItems`);
  atualizar imports (`lib/admin-predict.ts`→`lib/admin-forecast` plumbing,
  `observability/page.tsx`, `predict/page.tsx`).
- Rota atual `/admin/predict` (que hoje mostra o radar de intervalo) →
  **`/admin/forecast`**; label do menu "Previsão" → "Forecast"; libera
  `/admin/predict` para o motor novo.
- Mantém `forecast_config/overrides/snapshots`, `scripts/forecast.mjs`,
  `content/forecast.json`. Simplifica e **documenta** o algoritmo (comentários e
  nomes claros), sem alterar a matemática.
- Sai o espelho redundante `scripts/predictions.mjs` (vira `scripts/forecast.mjs`
  como única fonte do pipeline do radar).

### Fase B — Scaffolding do `predict` (namespace novo)
Criar o esqueleto isolado do motor robusto: tabelas `predict_*`, `lib/predict/*`,
`scripts/predict.mjs`, nova rota `/admin/predict`. Nada do `forecast` é tocado.

### Fase C — MVP `predict` (Fases 0 + 4 + 5 num programa)
Só depois da base pronta, o loop completo num programa-alvo (ver §11).

---

## 1. Contexto e problema

O predict atual é um **heurístico de intervalo**: colapsa "ondas" (campanhas quase
simultâneas), tira mediana/média dos intervalos por rota `origem→destino` e projeta a
próxima janela; confiança por contagem + coeficiente de variação. Config em
`forecast_config`, ajustes em `forecast_overrides`, histórico em `forecast_snapshots`;
aliases de programa **hardcoded** (`PROGRAM_ALIASES`).

Isso é justamente o "usar só a média histórica" que o contrato do produto proíbe. Faltam:

| Contrato exige | Hoje |
|---|---|
| Chave de série `origem+destino+tipo+mercado+segmento+mecânica` | só `origem→destino` |
| Catálogo canônico de programas + aliases | mapa hardcoded no código |
| Estados explícitos de notícia/backfill/previsão | `news_raw.processed` booleano |
| Dedup por chave estável + fontes (N notícias → 1 campanha) | sem campanha canônica |
| Observabilidade de backfill/extração/previsão | parcial |
| `data_readiness` + bloqueios | inexistente |
| **Backtesting walk-forward** | **inexistente** |
| Probabilidade por janela monotônica + distribuição de bônus | data única + % típico |
| Explicabilidade + versionamento (`as_of_date`, `model_version`) | básico |

**Diagnóstico:** o gargalo não é (só) o algoritmo — é a **camada de dados**. Sem série
homogênea, mecânica/segmento/mercado, % base vs máximo, estados e cobertura de backfill
medida, qualquer motor sofisticado devolve (corretamente) `insufficient`. Por isso a
reconstrução é **em camadas, dados primeiro**.

## 2. Objetivos e não-objetivos

**Objetivos.** Reconstruir o predict como um motor **auditável, replicável, versionado e
com gate**, que responde por série: quantas campanhas, quando, quais %, intervalos,
padrões, probabilidade e janela da próxima, % mais provável, confiança e as evidências
que sustentam — sempre rastreável até notícia/fonte.

**Não-objetivos.** Não é ML pesado nem dependência nova. A matemática é **determinística
em TypeScript** (espelhada em `.mjs` para o pipeline). LLM entra **só na extração**, nunca
na probabilidade. Sem prometer ganho; projeção estatística, nunca veredito.

## 3. Princípios inegociáveis (viram regra de código)

1. **Genérico e replicável** — zero regra especial p/ Livelo/LATAM; são só uma combinação.
2. **Nunca misturar** programas/mercados/segmentos/mecânicas na mesma série.
3. **Determinístico** nas probabilidades; LLM só na extração.
4. **Nunca dado futuro** (walk-forward corta antes de cada evento).
5. **Nunca inventar** data/%/programa; sem dado → `null`/`insufficient`.
6. **Nunca marcar falha como sucesso** (estados explícitos, não booleano).
7. **Sempre** evidência + confiança + rastreabilidade; **sempre** versionar e carimbar
   `as_of_date`.
8. **Bloquear** publicação quando os dados não estão prontos.

## 4. Arquitetura-alvo

Encaixa no stack atual, **sem dependência nova**:

- **Supabase/Postgres** guarda tudo. Volume é pequeno (centenas de campanhas) → agregação
  em **TS**, seguindo o padrão vigente: fonte da verdade em `lib/*.ts`, espelho ESM em
  `scripts/*.mjs` para o pipeline de render/cron.
- **Extração** segue na edge function `campaigns` (OpenRouter/Ollama), com **schema rico +
  evidências**.
- **Versionamento:** `model_version` (`campaign_predict_v2`) e `backtest_version`
  (`walk_forward_v1`) em cada snapshot; `as_of_date` sempre registrado.

Pipeline lógico:
```
INGEST → NORMALIZAÇÃO → EXTRAÇÃO → VALIDAÇÃO → DEDUP → BACKFILL
 → SÉRIES → BACKTESTING → PREVISÃO → EXPLICAÇÃO → MONITORAMENTO
```
Nenhuma previsão é produzida com etapa crítica incompleta.

## 5. Modelo de dados (migrações Supabase)

Chave de série (coluna gerada / determinística):
```
series_key = origem + '|' + destino + '|' + tipo_campanha + '|' + mercado + '|' + segmento + '|' + mecanica
```

Novas tabelas / colunas (nomes finais podem ajustar na implementação):

- **`programs`** (`slug` canônico, `nome`, `mecanicas_permitidas jsonb`) e
  **`program_aliases`** (`alias`, `program_slug`) — aposenta `PROGRAM_ALIASES`.
- **`campaigns`** (campanha **canônica**) ganha: `tipo_campanha, mercado, segmento,
  mecanica, percentual_base, percentual_maximo, percentual_clube, multiplicador, paridade,
  cadastro_obrigatorio, data_inicio, data_fim, data_publicacao, confianca_extracao,
  evidencias jsonb, series_key, dedup_key, sources_count`.
- **`campaign_sources`** (`campaign_id`, `news_id`, `source_url`, `first_seen`,
  `last_seen`) — N notícias → 1 campanha.
- **Estados** (substituem booleanos): `news_raw.status` ∈
  {`pending`,`processing`,`processed_no_campaign`,`processed_with_campaign`,`retry`,`error`}
  + `claimed_at/claimed_by` (concorrência); backfill ∈
  {`pending`,`running`,`done`,`retry`,`dead_letter`} + checkpoint; previsão ∈
  {`blocked`,`ready`,`generated`,`expired`,`superseded`}.
- **Observabilidade:** `extraction_runs`, `backfill_runs`, `backtest_results`; estender
  `forecast_snapshots` com o payload de observabilidade da previsão (features,
  probabilidades por janela, candidatos de bônus, `model_version`, `backtest_version`).

`dedup_key` estável (não depende só de `data_fim`):
```
origem + destino + tipo + mercado + segmento + data_inicio + data_fim + percentual_base + percentual_maximo
```

## 6. Motor de previsão (dois modelos separados)

**Modelo A — quando?** Distribuição histórica de intervalos + **hazard / probabilidade
condicional** dado `days_since_last`, ponderado por recência. Saída: **P{7,15,30,60,90,180}
monotônicas** (`P7 ≤ P15 ≤ … ≤ P180`), data central, janela [inf, sup], cenários
antecipado/central/tardio. Nunca probabilidades contraditórias.

**Modelo B — quanto?** Distribuição empírica dos percentuais (base/máx/clube) ponderada por
recência → **top-3 candidatos com probabilidades somando 1** + faixa provável + condição do
máximo. Não usa uma única média.

**Pesos de recência** (default, calibrados pelo backtest, persistidos em `forecast_config`):
últimas 3 campanhas 35% · 4–5 25% · 6–10 20% · histórico anterior 20%. Com pouca amostra,
evitar sobrepeso numa única campanha.

## 7. Data readiness e bloqueios

`data_readiness_status` por série ∈ {`ready`, `ready_with_warnings`, `insufficient_history`,
`backfill_incomplete`, `data_quality_blocked`}. Só publica em `ready`/`ready_with_warnings`.

**Bloqueia** (retorna `{forecast:null, confidence:"insufficient", block_reason, required_action}`)
quando: backfill sem cobertura mínima; < 3 campanhas válidas; datas principais ausentes;
série mistura mecânicas; dedup não resolvida; backtest não executável; origem/destino não
identificados.

Regras de confiança: <3 = insuficiente; 3–5 = baixa; 6–10 = baixa/média; >10 =
potencialmente média/alta; backfill incompleto/backtest ruim/alta variância/mudança
estrutural → **rebaixa** ao menos um nível; nunca "alta" sem backtest.

## 8. Backtesting (walk-forward, obrigatório)

Para cada campanha histórica: corta os dados imediatamente antes dela, prevê com o que era
conhecido, compara com o real, avança. Métricas persistidas em `backtest_results`: erro de
data (mediano/médio), window-hit-rate, **Brier** por janela, acurácia de % (exata e ±5pp),
calibração — por programa/parceiro/tipo/tamanho de histórico. Sem backtest → confiança não
pode ser "alta".

## 9. Explicabilidade e saída

- **Texto de negócio** por previsão: fatos usados, fatores que sobem/descem a
  probabilidade, variáveis de maior peso, limitações, qualidade do backfill, desempenho do
  backtest, razão do % previsto.
- **Tabela executiva** (uma linha por combinação analítica) + **JSON** por programa/parceiro
  com `historical`/`forecast`/`backtest`/`data_quality`/`explanation`, `as_of_date` e
  `pipeline_status`. Alimenta digests (daily/weekly) e o `/admin/predict`.

## 10. Fases

- **Fase 0 — Contratos & schema.** Migração: catálogo de programas, enriquecimento de
  `campaigns`, `campaign_sources`, máquinas de estado, tabelas de observabilidade.
- **Fase 1 — Extração v2.** Prompt/schema rico (base vs máximo, direção, evidências,
  `not_a_loyalty_campaign`), normalização via catálogo, dedup, `extraction_runs`,
  retries/backoff/dead_letter/claim.
- **Fase 2 — Backfill observável.** State machine + checkpoint + cobertura por fonte e por
  mês + `cobertura_estimada`; critério de conclusão real (sem "18 meses" sem prova).
- **Fase 3 — Séries + readiness.** Builder por `series_key` (volume/datas/intervalos/
  distribuição de %/recência/sazonalidade) + `data_readiness_status` que bloqueia.
- **Fase 4 — Motor v2.** Substitui o interior de `lib/predictions.ts`: Modelo A (hazard) +
  Modelo B (distribuição de bônus), pesos de recência.
- **Fase 5 — Backtesting.** Harness walk-forward + métricas + rebaixamento de confiança.
- **Fase 6 — Explicabilidade/versão/saída.** Texto de negócio, snapshot observável, tabela
  executiva + JSON, comparação intra-programa.
- **Fase 7 — Admin & gate.** `/admin/predict` mostra `pipeline_status`, readiness/cobertura,
  histórico, forecast (janelas+bônus), métricas de backtest, explicação e **bloqueios**.

## 11. Decisão de sequência — MVP ponta-a-ponta primeiro

Primeira entrega = **Fases 0 + 4 + 5** num **único programa/destino com mais histórico**
(candidato: LATAM Pass como destino, por concentrar transferências de múltiplas origens):

1. **Schema mínimo** (Fase 0) só para esse recorte: `series_key`, campos de %
   (base/máx/clube), `campaign_sources`, `backtest_results`.
2. **Motor A/B** (Fase 4) rodando nesse programa.
3. **Backtesting** (Fase 5) reportando as métricas — prova a matemática antes de investir no
   backfill pesado.
4. **Gate visível** no admin: séries sem histórico aparecem **bloqueadas**, nunca com número
   inventado.

Só depois de o loop fechar (extração→série→forecast→backtest→gate→admin) num programa é que
se generaliza para todos e se investe em extração v2 (Fase 1) e backfill observável (Fase 2)
em escala.

### Critérios de aceite do MVP
- Toda série do programa-alvo tem `series_key`, `data_readiness_status` e (quando `ready`)
  P{7..180} monotônicas + top-3 de bônus somando 1.
- `backtest_results` existe para o programa-alvo com pelo menos erro-de-data mediano e
  window-hit-rate calculados.
- `/admin/predict` mostra explicação em linguagem de negócio e bloqueia séries insuficientes.
- Zero regra hardcoded para um par específico; trocar o programa-alvo é só mudar um filtro.

## 12. Reaproveitamento vs descarte

- **Mantém:** padrão TS↔`.mjs`; `forecast_config`/`forecast_overrides`/`forecast_snapshots`;
  plumbing de `lib/admin-predict.ts` (config/overrides/snapshots); estética do admin
  (tokens de marca, sem shadcn, sem dependência nova); `windowDate()` (deriva a data real da
  janela — bom guardrail contra `observed_at`/`first_seen`).
- **Descarta:** a lógica de intervalo-médio de `predictions.ts` e o `PROGRAM_ALIASES`
  hardcoded (migram para o catálogo).

## 13. Verificação

- `npm run typecheck` / `lint` / `build` verdes.
- `npm run forecast` gera o JSON com `pipeline_status` e `as_of_date`; um script de backtest
  reporta as métricas no CI editorial.
- Migrações aplicadas via `apply_migration` (Supabase), com **seed do catálogo** a partir
  dos dados atuais.
- Conferência no admin: séries sem histórico **bloqueadas**; nenhuma data/% inventada.

## 14. Riscos e questões em aberto

- **Cobertura de backfill real** é a maior incógnita: sem histórico suficiente, o MVP vai
  (corretamente) bloquear a maioria das séries. Medir cobertura por programa/mês antes de
  prometer previsão.
- **Qualidade de extração atual** não traz mercado/segmento/mecânica/% base-vs-máximo; até a
  Fase 1 rodar, esses campos entram parciais/`null` e limitam o número de séries `ready`.
- **Nota de branch:** este trabalho sai da branch de produção (à frente da `main`), não da
  `main`.
