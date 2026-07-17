# ADR-RADAR-010 — Validação de plausibilidade temporal

- **Status:** accepted (ratificada 2026-07-17 — ver "Ratificação" abaixo)
- **Data:** 2026-07-15 · **Ratificação:** 2026-07-17 (chat de predict, D-040)
- **Relacionado:** arquitetura §6, §27d.2, §27d.4, §27f; ADR-RADAR-002, ADR-RADAR-009;
  `docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md` §12, §26; `docs/auditoria/edge-function-campaigns.md`

## Contexto
A edge fn `campaigns` grava `vigencia_inicio`/`vigencia_fim` **como o LLM devolve, sem
validação**. `first_seen` = `news_raw.published_at` (proveniência). Em 77% das
transferências, a data de evento resolvida fica **>180 dias antes** de `first_seen`
(média +310 dias; erro de ano). Nenhuma checagem compara evento × proveniência.

## Problema
Sem uma política de plausibilidade, datas fabricadas (erro de ano/mês) entram na série
de produção como se fossem reais. É preciso **detectar** e **bloquear** — **sem corrigir
automaticamente** (o texto pode, legitimamente, ser sobre campanha antiga).

## Decisão proposta
Função conceitual **`evaluateTemporalPlausibility(campaign, provenance)`**, executada na
camada de qualidade (antes das séries). Recebe as **datas de evento** (`vigencia_inicio`,
`vigencia_fim`, `data_anuncio`) e as **datas de proveniência** (`data_publicacao`=`first_seen`,
`observed_at`, `created_at`) e produz flags. Limiares são **iniciais** (a calibrar).

| Flag | Condição | Limiar inicial | Severidade | Bloq. Forecast | Bloq. Predict | Bloq. publicação | Reprocessa | Revisão humana | Auto-corrige |
|---|---|---|---|---|---|---|---|---|---|
| `valid` | datas coerentes entre si e com a proveniência | — | ok | não | não | não | não | não | n/a |
| `missing_event_date` | sem `vigencia_inicio`/`data_anuncio`/`vigencia_fim` resolvível | — | média | **sim** | **sim** | sim | não | opcional | **não** |
| `suspect_year` | `data_evento` diverge de `data_publicacao` por >18 meses **e** fonte recente | 548 d | **alta** | **sim** | **sim** | **sim** | **sim** | **sim** | **não** |
| `suspect_month` | mês do evento destoa da vizinhança da série; ano/dia plausíveis | > k·MAD do mês esperado | média | sim | **sim** | sim | sim | **sim** | **não** |
| `suspect_day_month` | `dd≤12` e `mm≤12` e a data destoa (possível troca dd/mm) | destoa da série | média | sim | **sim** | sim | sim | **sim** | **não** |
| `event_far_before_source` | `data_evento` muito anterior à `data_publicacao` | > 365 d | **alta** | **sim** | **sim** | **sim** | **sim** | **sim** | **não** |
| `event_after_source` | `data_evento` posterior à `data_publicacao` (evento futuro) | > 0 d | baixa/informativa | não | não | não | não | opcional | **não** |
| `conflicting_event_dates` | `vigencia_inicio > vigencia_fim`, ou anúncio depois do fim | — | **alta** | **sim** | **sim** | **sim** | **sim** | **sim** | **não** |
| `invalid_date` | fora de faixa, parse falho, `vigencia_fim` texto-lixo (`na` tratado à parte) | — | **alta** | **sim** | **sim** | **sim** | não | opcional | **não** |

**Nenhuma flag corrige a data automaticamente.** Datas suspeitas saem da série de
produção (`include_in_prediction=false`), ficam **visíveis no admin com o motivo**, e
entram na fila de **reprocessamento** e/ou **revisão humana**.

**Distinções obrigatórias** (a política precisa diferenciar, não colapsar):

| Situação | Sinais | Tratamento |
|---|---|---|
| Artigo recente sobre campanha **antiga legítima** | texto data explicitamente o passado; coerente | `valid` (data antiga aceita, confiança conforme fonte) |
| Artigo recente com data antiga **provavelmente fabricada** | evento << publicação, sem menção textual ao passado | `suspect_year` / `event_far_before_source` → bloqueia |
| Campanha **prorrogada** | mesma identidade, `campaign_version=prorrogacao`, nova `vigencia_fim` | 1 identidade (ADR-009); não é nova onda |
| **Republicação** | mesmo conteúdo, nova `data_publicacao` | `source_observation` adicional; não é nova campanha |
| **Erro de ano** | `suspect_year` (o caso dominante) | bloqueia + reprocessa + revisa |
| **Fim sem início** | só `vigencia_fim` | `exact_end` marcado, confiança média (ADR-002) — não é suspeito por si só |
| **Campanha permanente** | `vigencia_fim="na"`, ativa | `permanent` (estado, não onda) — ADR-002 §6.6 |
| **Data ambígua sem ano** | texto sem ano ("dia 12") | `missing_event_date`/`suspect_*` conforme inferência; nunca inventar ano |

**Exemplo canônico obrigatório** (o `livelo→connectmiles`):
```
vigencia_fim    = 2023-12-12   (evento; provavelmente fabricado de "hoje (12)")
data_publicacao = 2026-07-12   (proveniência = first_seen)
first_seen      = 2026-07-12
observed_at     = 2026-07-13
→ temporal_status       = suspect_year        (event_far_before_source: 943 d)
  include_in_prediction = false
  requires_reprocessing = true
  requires_human_review = true
```
**Não** corrigir automaticamente para `2026-07-12`.

## Consequências positivas
- Datas fabricadas não entram na série; o 943d é contido na origem.
- Distingue "campanha antiga legítima" de "erro de ano".

## Consequências negativas
- Menos campanhas elegíveis até o reprocessamento/curadoria melhorar a extração.
- Falsos positivos de `suspect_*` geram fila de revisão.

## Riscos
- Limiares mal calibrados: altos demais deixam passar erro; baixos demais inundam a
  revisão.
- Campanhas antigas legítimas marcadas como suspeitas (mitigado pela distinção textual).

## Questões em aberto
- Limiares exatos (548 d / 365 d / k·MAD são propostas).
- Como incorporar evidência textual ("último dia", "prorrogado", menção explícita a ano)
  no julgamento — depende do schema de extração v2.

## Critério para `accepted`
Aprovação do usuário das flags, dos limiares iniciais, da matriz de bloqueio e do
princípio **"proveniência valida, não substitui; nunca autocorrigir"**.

## Ratificação (2026-07-17)
Ratificada pelo operador no chat de predict (D-040), destravando a slice de
plausibilidade temporal como **pré-requisito** de toda calibração do predict.

**Ressalva explícita — o que foi ratificado e o que não:**
- **Ratificado (final):** o *mecanismo* de detecção — as flags, a matriz de bloqueio
  (Forecast/Predict/publicação/reprocessa/revisão), as distinções obrigatórias e o
  princípio **"proveniência valida, não substitui; nunca autocorrigir"** (INV-16
  aplicado ao tempo).
- **NÃO congelado:** os **limiares numéricos** (548 d para `suspect_year`, 365 d para
  `event_far_before_source`, `k·MAD` para `suspect_month`). São valores **de partida**
  e são eles próprios **alvo de calibração do Agente 3** contra o corpus. Afiná-los com
  dado **não reabre esta ADR** — a ADR ratifica a detecção de ano suspeito, não o número
  exato do corte. Os limiares finais entram como versão calibrada, com antes/depois.
