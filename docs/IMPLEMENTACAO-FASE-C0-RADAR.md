# Implementação — Fase C0 (Contenção de resultados incoerentes)

> Registro do que foi **efetivamente implementado** na Fase C0 do Radar
> Preditivo de Campanhas. Contenção sobre o modelo e o schema **atuais** — sem
> novo modelo de dados, sem migração, sem reconciliador, sem snapshot canônico.
> Fonte de desenho: `docs/ARQUITETURA-PRODUTO-RADAR-PREDITIVO.md` §27c e os ADRs
> `docs/architecture/adr/ADR-RADAR-00{1..8}.md` (status `proposed`, inalterado).

## 1. Escopo

Impedir que previsões frágeis, desatualizadas, contraditórias ou baseadas em
séries anômalas cheguem ao leitor, atuando sobre o código atual. **Não** redesenha
o Radar. Fora de escopo (não iniciado): R-01…R-19 da arquitetura (schema novo,
`vigencia_type`/`data_evento`, `series_key`/`wave_key`/`dedup_key`, catálogo
`programs`, reconciliador, snapshot canônico, `prediction_outcomes`, backfill
completeness, admin unificado, integração Predict→Digest).

## 2. Mudanças (por contenção)

| Contenção | Como foi implementada |
|---|---|
| Gate de amostra editorial | `editorialGate()` em `lib/forecast.ts` (+ espelho MJS): série com `< minEditorialWaves` (5) ondas fica `editorialEligible=false`. Cálculo interno intacto. |
| Bloqueio por intervalo extremo | intervalo `≥ extremeIntervalDays` (540) → inelegível + warning; `>900` → warning específico. Intervalo **preservado** no histórico. |
| Gate de horizonte editorial | janela central `> maxEditorialHorizonDays` (180) → inelegível + `requiresEditorialReview`; `>365` → warning crítico. Sem truncar a data. |
| Leitura completa do ledger | `fetchAllRows()` (`lib/admin-db.ts`) pagina `order=id.asc` sem o `limit=2000`. Usado em admin-forecast, admin-predict, observability e `scripts/forecast.mjs`. `datasetComplete` sinaliza carga parcial → radar bloqueado. |
| Frescor do artefato | `scripts/forecast-freshness.mjs` classifica `content/forecast.json` em fresh/stale/missing/invalid/incomplete (idade máx 24h). `render-weekly` só usa números `fresh`. |
| Radar contraditório no Daily | `validateRadarConsistency()` (`scripts/validate.mjs`, wired em `qa.mjs`): janela marcada automática que divirja do forecast → **erro**; radar sem proveniência → tratado como análise editorial (**aviso**). |
| Alerta de intervalos longos | `warnings[]` + `maxIntervalDays` por série, exibidos no admin (destaque de cor ≥365/≥540). |
| Copy da interface | `observability`: “menos de N janelas” agora usa `minSamples` real. `forecast`: percentual rotulado “bônus ~x%”. `Sidebar`: hints forecast/predict descruzados. |
| Testes dos motores | 4 novos arquivos de teste (§8). |
| Paridade TS×MJS | `tests/forecast-parity.test.mjs` compara `lib/forecast.ts` × `scripts/forecast-engine.mjs` por fixture — CI falha se divergirem. |

## 3. Arquivos alterados

**Motor (espelhado):** `lib/forecast.ts`, `scripts/forecast-engine.mjs`
**Carga completa:** `lib/admin-db.ts` (`fetchAllRows`), `lib/admin-forecast.ts`,
`lib/admin-predict.ts`, `app/admin/(panel)/observability/page.tsx`,
`scripts/forecast.mjs`
**Frescor:** `scripts/forecast-freshness.mjs` (novo), `scripts/render-weekly.mjs`
**Radar Daily:** `scripts/validate.mjs`, `scripts/qa.mjs`,
`content/edition.schema.json`, `content/weekly.schema.json`
**Admin:** `app/admin/(panel)/forecast/page.tsx`,
`app/admin/(panel)/predict/page.tsx`, `components/admin/Sidebar.tsx`
**Testes (novos):** `tests/forecast-engine.test.mjs`,
`tests/forecast-parity.test.mjs`, `tests/forecast-freshness.test.mjs`,
`tests/radar-consistency.test.mjs`
**Docs:** este arquivo + nota em `ARQUITETURA-PRODUTO-RADAR-PREDITIVO.md` §27c.

## 4. Novos parâmetros (defaults versionados em código)

```
minEditorialWaves        = 5     # < N ondas → inelegível p/ publicação
longIntervalWarningDays  = 365   # intervalo acima → warning
extremeIntervalDays      = 540   # intervalo acima → warning crítico + bloqueia
maxEditorialHorizonDays  = 180   # janela além → revisão + bloqueia
DEFAULT_MAX_FORECAST_AGE_HOURS = 24   # (override por env MAX_FORECAST_AGE_HOURS)
```

Os quatro primeiros vivem em `DEFAULT_FORECAST_CONFIG` (TS e MJS, idênticos); a
config persistida do admin (`forecast_config`, 8 colunas) **não** foi alterada —
os novos parâmetros são defaults de código (sem migração).

## 5. Comportamento anterior × novo

| Situação | Antes | Agora |
|---|---|---|
| Série com 2 ondas (1 intervalo) | virava janela ±3d publicável | calculada, mas **inelegível** (`historico_insuficiente_para_publicacao`) |
| Intervalo de 943 dias | entrava cru, sem alerta, prevendo anos à frente | preservado, **sinalizado** (warning >900), série inelegível |
| `livelo→connectmiles` | previa janela distante (centro ~2029-02) e podia vazar | centro ~2029 **calculado mas bloqueado**; nunca entra em radar/weekly |
| Leitura do ledger | `limit=2000` sobre 2.438 linhas, sem ordem → ~438 descartadas | leitura paginada completa (`order=id.asc`); `datasetComplete` |
| `content/forecast.json` velho | Weekly usava números stale em silêncio | `render-weekly` bloqueia stale/incompleto e loga o motivo |
| Radar do Daily | manual, podia contradizer o Weekly | automático divergente → erro de QA; manual → “análise editorial” |
| Admin forecast | sem nº de ondas, última, maior intervalo, elegibilidade | colunas novas + banner de dataset incompleto + rótulo de bônus |
| Copy “menos de 3 janelas” | fixa e incorreta | derivada do `minSamples` real |

## 6. Casos bloqueados (contenção efetiva)

- Série com `< 5` ondas → não vira radar (daily/weekly), não é promovível.
- Série com intervalo `≥ 540` dias → bloqueada (com warning), salvo override com nota.
- Janela central `> 180` dias → bloqueada + `requiresEditorialReview`.
- `datasetComplete=false` → radares vazios; **pin não ignora**.
- `forecast.json` stale/incompleto/ausente/inválido → Weekly sem números automáticos.
- Janela de radar marcada automática que divirja/ausente no forecast → erro de QA.

## 7. Testes (54 casos novos; suíte total = 89)

- `tests/forecast-engine.test.mjs` (30): `windowDate` (prioridade, `na`/inválida,
  ignora `observed_at`/`first_seen`), `collapseWaves`, formação rota×cluster,
  gates 1/2/4/5/6 ondas, intervalo 943 (preservado+sinalizado+bloqueado),
  horizonte >180/>365, série mensal saudável elegível.
- `tests/forecast-parity.test.mjs` (9): TS×MJS por fixture (regular, 2 ondas,
  943 dias, duplicatas, ondas em 3 dias, sem data, aliases) + `editorialGate` + defaults.
- `tests/forecast-freshness.test.mjs` (7): fresh/stale/limite/missing/invalid/incomplete.
- `tests/radar-consistency.test.mjs` (8): automático coerente/divergente/ausente,
  manual → aviso, sem artefato.

Validação: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` ✅;
`npm run forecast` (offline), `npm run weekly`, `npm run edition` (índices locais) ✅.

## 8. Limitações e dívidas mantidas

- **TS e MJS continuam duplicados** — a paridade é garantida por teste, não por
  fonte única (centralização = fase estrutural).
- **Frescor só no Weekly** — o Daily segue com radar manual/editorial; a
  contenção do Daily é por proveniência + QA, não por consumo de snapshot.
- **Retrofit de edições legadas** (marcar o radar de 0028 como “análise
  editorial”) **não** foi feito — não se altera conteúdo/dados existentes na C0.
  Edições sem proveniência geram apenas aviso.
- **Anomalia de intervalo é limiar fixo** (365/540/900), não MAD/IQR — a
  detecção estatística robusta fica para a fase estrutural (ADR-RADAR-005).
- **Predict** segue sem config editável e sem overrides; readiness
  `backfill_incomplete`/`data_quality_blocked` continuam não atribuídos.
- **`datasetComplete=false` real** só ocorre no teto de páginas ou falha de
  página; falha total de rede cai em modo offline (mantém o artefato anterior).
- **Causa raiz do caso 943d é dado, não modelo.** A evidência canônica
  (`docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md` + `docs/RECONCILIACAO-AUDITORIAS-RADAR.md`)
  mostra que `livelo→connectmiles` são **dois registros da MESMA campanha** — um com
  `vigencia_fim` **fabricada** (2023-12-12) por erro de extração. A C0 **contém o
  sintoma** (série de 2 ondas / intervalo extremo / horizonte → bloqueada e
  sinalizada, centro calculado ~2029), mas **não corrige** a duplicidade/data — isso
  é validação temporal + deduplicação a montante (ADR-RADAR-009/010, fase
  estrutural). Por isso o warning fala em “anomalia de dado (data suspeita,
  duplicidade ou lacuna)”, não em lacuna de backfill.

## 9. Itens NÃO implementados (fase estrutural — R-01…R-19)

Modelo de dados novo; `vigencia_type`/`vigencia_raw`; `data_evento`;
`series_key`/`wave_key`/`dedup_key`; catálogo `programs`/`program_aliases`;
reconciliador Forecast×Predict; snapshot canônico + `prediction_snapshot_usages`;
`prediction_outcomes`; backfill completeness (6 camadas); admin Radar unificado;
integração Predict→Digest; correção/reprocessamento em massa de dados.

## 10. Plano de rollback

Puramente por reversão de commits — **nenhum** dado, schema, migration,
snapshot de produção, backfill ou publicação foi tocado:

```
git revert <sha_docs> <sha_admin> <sha_editorial> <sha_freshness> <sha_dataset> <sha_tests> <sha_engine>
# ou, para a branch inteira do PR #54, reverter o range de commits fase C0.
```

Os parâmetros são constantes de código; reverter o motor restaura o
comportamento anterior sem efeitos colaterais externos. `content/forecast.json`
não foi regenerado nesta fase (mantido como estava).

---

# C0.2 — Validação temporal e duplicidade provável

Extensão da Fase C0 que age **antes da formação de ondas/intervalos**, para que
campanhas temporalmente incoerentes ou provavelmente duplicadas não entrem nas
séries do Forecast nem do Predict. Tudo em **runtime**, sem tocar o banco.

```
campaigns → validação temporal → detecção de duplicidade → conjunto elegível
→ formação de ondas → intervalos → Forecast/Predict → gates editoriais (C0)
```

## Funções (fonte compartilhada)

Módulo puro `lib/campaign-quality.ts` (+ espelho `scripts/campaign-quality.mjs`),
injetável (`normalize`=normProgram do motor). O `normalize` compartilhado evita
regras divergentes entre Forecast e Predict.

- `resolveEventDateCandidate(row)` — data candidata pela **mesma** prioridade do
  `windowDate` (início > data no id > fim). Ser ISO válida ≠ ser plausível.
- `evaluateTemporalPlausibility(row, config)` → `{status, severity, flags,
  eventDate, provenanceDate, dayDifference, includeInPrediction,
  requiresReprocessing, requiresHumanReview, reasons}`.
- `detectProbableDuplicates(rows, temporalById, {config, normalize})` →
  `{groups, byCampaignId}` (`unique|possible_duplicate|probable_duplicate`).
- `isCampaignEligibleForPrediction(row, temporal, duplicate, {normalize})`.
- `assessCampaignQuality(rows, {config, normalize})` — **ponto único**: filtra
  transferências, avalia temporal + duplicidade e devolve `{perId, eligibleRows,
  excluded, counters, duplicateGroups}`. Chamado igual por `buildForecast`
  (TS+MJS) e `buildPredict`.

## Regras — datas de evento × proveniência

- **Evento** (ancoram a série): `vigencia_inicio`, data no `id`, `vigencia_fim`.
- **Proveniência** (só validam plausibilidade, **nunca** substituem o evento nem
  entram na série): `first_seen` (= data de publicação da notícia, por
  `docs/auditoria/edge-function-campaigns.md`), `observed_at`, `created_at`,
  `last_seen`. `dayDifference` = proveniência(mín) − evento.

Estados: `valid`, `missing_event_date`, `invalid_event_date`,
`permanent_or_open_ended`, `event_far_before_source`, `event_after_source`,
`conflicting_event_dates`, `suspect_year` (o mais grave prevalece; `flags` lista
todos).

## Limiares (centralizados em `DEFAULT_QUALITY_CONFIG`)

```
eventFarBeforeSourceWarningDays  = 180   # > → event_far_before_source (warning)
eventFarBeforeSourceCriticalDays = 300   # > e sem início explícito → suspect_year (exclui)
eventAfterSourceToleranceDays    = 30    # evento > maxProv + 30 → event_after_source (revisão)
yearMismatchToleranceDays        = 300   # divergência entre candidatas → conflicting
provenanceProximityDays          = 15    # dedup: first_seen/observed_at próximos
duplicatePossibleScore           = 3     # ≥ → possible_duplicate
duplicateProbableScore           = 5     # ≥ → probable_duplicate
```

**Score de duplicidade** (documentado): mesmo percentual +2 (próximo ≤5pp +1),
proveniência ≤15d +2, mesmo domínio de fonte +1, mesma URL +1, **uma data válida
+ uma temporalmente crítica +3**, vigência incompatível (>300d) +1. Origem/destino/
tipo são a **pré-condição** (agrupamento), nunca pontuam sozinhos — bônus isolado
(+2) fica abaixo do limiar de possível.

## Caso Livelo→ConnectMiles — antes × depois

| | Registro A (`…-2023-12-12`) | Registro B (`…-2026-07-12`) |
|---|---|---|
| `vigencia_inicio` | null | null |
| `vigencia_fim` | 2023-12-12 (fabricada) | 2026-07-12 |
| `first_seen` (proveniência) | 2026-07-12 | 2026-07-10 |
| **Antes** | entrava; 943d era formado; Forecast previa ~2029 | entrava |
| **Depois** | `suspect_year` (Δ 943d), `includeInPrediction=false`, **excluído** | `valid`, elegível |
| Par A/B | `probable_duplicate` (score 8) | idem |

Resultado: o intervalo de 943 dias **não é formado**, a rota fica com 1 onda
(→ em-formação no Forecast; bloqueada no Predict), **não há previsão de 2029**, e
o **Predict recebe exatamente o mesmo conjunto elegível**. Nenhuma data é
corrigida; ambos os registros permanecem no banco e visíveis no admin.

## Falsos positivos possíveis (e mitigação)

- **Notícia recente sobre campanha antiga real:** se `vigencia_inicio` explícita =
  data do evento, rebaixa de `suspect_year` → `event_far_before_source` (warning)
  + `requiresHumanReview`, **sem excluir** e **sem autocorrigir** para `first_seen`.
- **Campanha futura legítima:** `event_after_source` gera revisão, não bloqueio
  automático.
- **Duplicidade:** exige combinação de sinais (não só bônus); `possible_duplicate`
  só bloqueia se combinado com erro temporal crítico.

## Limitações do runtime

- Deteção é **calculada a cada execução** (não persistida) — reversível, mas não
  cria `campaign_identity`/`version`/`source_observation` no banco.
- Sem texto/título das notícias no ledger, o sinal de “prorrogação/último dia”
  não é usado (score baseia-se nas colunas disponíveis).
- Em `probable_duplicate` **sem** membro temporalmente crítico, ambos permanecem
  elegíveis (apenas sinalizados) — evitar descartar dado arbitrariamente.
- `suspect_month`/`suspect_day_month` estão no enum mas não são emitidos ainda
  (heurística fina adiada).

## O que ainda exige migration (fase estrutural)

Persistir identidade/versão/observação; `vigencia_type`+`vigencia_raw`;
`data_evento` materializada; catálogo `programs`/`program_aliases`; merge/dedup
persistido; reprocessamento dirigido por `requiresReprocessing`. Nada disso é
feito aqui.

## Rollback

Reverter os commits C0.2 (`feat(radar): temporal quality…`, `fix(radar): apply
campaign quality…`, `test(radar): c0.2…`, `fix(admin): expose temporal…`) e a
linha `allowImportingTsExtensions` do tsconfig. Como é 100% runtime, o motor
volta ao comportamento C0 sem qualquer efeito no banco ou em produção.
